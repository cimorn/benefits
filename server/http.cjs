const http = require('node:http');
const {readFile} = require('node:fs/promises');
const path = require('node:path');
const {createAuth} = require('./auth.cjs');
const {connectBenefitsStore} = require('./store.cjs');

// Runtime configuration, server source, tests, and .git are never served.
const staticResources = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/data.js', ['data.js', 'text/javascript; charset=utf-8']],
  ['/inventory-app.js', ['inventory-app.js', 'text/javascript; charset=utf-8']],
  ['/model.js', ['model.js', 'text/javascript; charset=utf-8']],
  ['/inventory.js', ['inventory.js', 'text/javascript; charset=utf-8']],
  ['/cloud.js', ['cloud.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']]
]);
const problem = (message, status = 400, code = 'INVALID_REQUEST') => Object.assign(Error(message), {safe: true, status, code});
const configurationError = message => Object.assign(Error(message), {configuration: true});

function config(environment) {
  const production = environment.NODE_ENV === 'production';
  const cloud = Boolean(environment.MONGODB_URI);
  if (production && !cloud) throw configurationError('生产环境必须设置 MONGODB_URI。');
  if (!cloud) return {production, cloud, origin: null};
  let origin;
  try {
    const parsed = new URL(environment.APP_ORIGIN);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw Error();
    origin = parsed.origin;
  } catch { throw configurationError('请设置有效的 APP_ORIGIN。'); }
  if (production && !origin.startsWith('https://')) throw configurationError('APP_ORIGIN 必须使用 HTTPS。');
  if (typeof environment.APP_PASSWORD !== 'string' || !environment.APP_PASSWORD.length || environment.APP_PASSWORD.length > 512) throw configurationError('请设置有效的 APP_PASSWORD。');
  if (typeof environment.SESSION_SECRET !== 'string' || environment.SESSION_SECRET.length < 32) throw configurationError('SESSION_SECRET 必须至少 32 位。');
  return {production, cloud, origin};
}

async function jsonBody(request, limit) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) throw problem('请使用 JSON 请求。', 415);
  const sizeHeader = request.headers['content-length'];
  if (sizeHeader && Number(sizeHeader) > limit) throw problem('请求内容过大。', 413, 'PAYLOAD_TOO_LARGE');
  const chunks = [];
  let size = 0;
  // A normal async iterator destroys its stream when size validation throws.
  // Preserve the socket so oversized chunked requests can receive HTTP 413.
  for await (const chunk of request.iterator({destroyOnReturn: false})) {
    size += chunk.length;
    if (size > limit) throw problem('请求内容过大。', 413, 'PAYLOAD_TOO_LARGE');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw problem('JSON 数据格式无效。'); }
}

async function createServer({environment = process.env, store, staticDir = path.resolve(__dirname, '..')} = {}) {
  const {production, cloud, origin} = config(environment);
  let closeStore;
  const auth = cloud ? await createAuth({password: environment.APP_PASSWORD, secret: environment.SESSION_SECRET, secure: production}) : null;
  if (cloud && !store) {
    const connected = await connectBenefitsStore(environment);
    store = connected.store;
    closeStore = connected.close;
  }
  const headers = {
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
  };
  if (production) headers['Strict-Transport-Security'] = 'max-age=31536000';
  const server = http.createServer(async (request, response) => {
    const send = (status, data, extra = {}) => {
      if (response.headersSent || response.destroyed) return;
      response.writeHead(status, {...headers, 'Content-Type': 'application/json; charset=utf-8', ...extra});
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify(data));
    };
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/healthz' && request.method === 'GET') return send(200, {ok: true});
      const localOrigin = `http://${request.headers.host}`;
      if (origin ? request.headers.host !== new URL(origin).host : !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(localOrigin)) throw problem('请求域名无效。', 403, 'INVALID_HOST');
      if (!['GET', 'HEAD', 'POST'].includes(request.method)) return send(405, {error: '不支持此请求。'}, {Allow: 'GET, HEAD, POST'});
      if (request.method === 'POST' && (request.headers.origin !== (origin || localOrigin) || request.headers['sec-fetch-site'] === 'cross-site')) throw problem('请求来源无效，请从本站页面重试。', 403, 'INVALID_ORIGIN');
      const session = () => ({mode: cloud ? 'cloud' : 'local', authenticated: cloud ? auth.session(request) : true});
      if (url.pathname === '/api/session' && request.method === 'GET') return send(200, session());
      if (url.pathname === '/api/login' && request.method === 'POST' && cloud) {
        const result = await auth.login(() => jsonBody(request, 4096), request.socket.remoteAddress);
        return send(result.status, result.cookie ? {mode: 'cloud', authenticated: true} : {error: result.error}, result.cookie ? {'Set-Cookie': result.cookie} : result.retryAfter ? {'Retry-After': String(result.retryAfter), Connection: 'close'} : {});
      }
      if (url.pathname === '/api/logout' && request.method === 'POST' && cloud) return send(200, {mode: 'cloud', authenticated: false}, {'Set-Cookie': auth.clear()});
      if (url.pathname === '/api/benefits') {
        if (!cloud) throw problem('本地模式使用当前浏览器存储。', 409, 'CLOUD_NOT_CONFIGURED');
        if (!auth.session(request)) throw problem('请先登录。', 401, 'AUTH_REQUIRED');
        if (request.method === 'GET') return send(200, await store.read());
        if (request.method === 'POST') return send(200, await store.save(await jsonBody(request, 4 * 1024 * 1024)));
        return send(405, {error: '不支持此请求。'}, {Allow: 'GET, POST'});
      }
      if (!['GET', 'HEAD'].includes(request.method)) return send(405, {error: '不支持此请求。'}, {Allow: 'GET, HEAD'});
      const resource = staticResources.get(url.pathname);
      if (!resource) return send(404, {error: '页面不存在。'});
      const data = await readFile(path.join(staticDir, resource[0]));
      response.writeHead(200, {...headers, 'Content-Type': resource[1]});
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (error.status === 413 && !request.readableEnded && !request.destroyed) {
        // Drain without retaining bytes before closing a large upload. Closing
        // with unread TCP data can reset the socket before the client sees 413.
        await new Promise(resolve => {
          request.once('end', resolve);
          request.once('error', resolve);
          request.resume();
        });
      }
      send(error.safe ? error.status || 400 : 503, {error: error.safe ? error.message : '服务暂时不可用，请稍后重试。', ...(error.safe && error.code ? {code: error.code} : {})}, error.status === 413 ? {Connection: 'close'} : {});
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  if (closeStore) server.once('close', () => { closeStore().catch(() => {}); });
  return server;
}

module.exports = {createServer, staticResources};
