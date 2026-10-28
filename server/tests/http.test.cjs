const test = require('node:test');
const assert = require('node:assert/strict');
const {once} = require('node:events');
const http = require('node:http');
const {MemoryCollection, record, write, exported} = require('./helpers.cjs');
let backend = {}, stores = {};
try { backend = require('../../server.cjs'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
try { stores = require('../store.cjs'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
const cloudEnvironment = () => ({NODE_ENV: 'production', MONGODB_URI: 'mongodb://localhost/benefits_test', APP_ORIGIN: 'https://benefits.example.test', APP_PASSWORD: 'test-only-password', SESSION_SECRET: 'test-only-secret-at-least-32-characters'});

async function running(t, environment = cloudEnvironment()) {
  const service = environment.MONGODB_URI ? await exported(stores, 'createBenefitsStore')(new MemoryCollection()) : undefined;
  const server = await exported(backend, 'createServer')({environment, store: service});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const origin = environment.APP_ORIGIN || url;
  let cookie = '';
  async function request(path, options = {}) {
    const headers = {Host: new URL(origin).host, ...(cookie ? {Cookie: cookie} : {}), ...options.headers};
    if (options.body !== undefined) {headers['Content-Type'] ||= 'application/json'; headers.Origin ||= origin;}
    // Native fetch drops a custom Host header in newer Node versions; use the
    // HTTP client to exercise the exact reverse-proxy request contract.
    return new Promise((resolve, reject) => {
      const client = http.request(url + path, {method: options.method || 'GET', headers, agent: false}, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          const responseHeaders = new Headers();
          for (let index = 0; index < response.rawHeaders.length; index += 2) responseHeaders.append(response.rawHeaders[index], response.rawHeaders[index + 1]);
          resolve(new Response(Buffer.concat(chunks), {status: response.statusCode, headers: responseHeaders}));
        });
      });
      client.on('error', reject);
      client.end(options.body === undefined ? undefined : typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    });
  }
  async function login() {
    const response = await request('/api/login', {method: 'POST', body: {password: 'test-only-password'}});
    assert.equal(response.status, 200);
    cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  }
  return {request, login};
}

test('local mode keeps static app working and reveals no runtime files', async t => {
  const {request} = await running(t, {});
  assert.deepEqual(await (await request('/api/session')).json(), {mode: 'local', authenticated: true});
  assert.equal((await request('/')).status, 200);
  assert.equal((await request('/model.js')).status, 200);
  for (const pathname of ['/.env', '/server.cjs', '/package.json', '/server/auth.cjs', '/.git/config', '/%2e%2e/AGENTS.md']) assert.equal((await request(pathname)).status, 404);
});

test('production fails closed without database, HTTPS origin, password, or session secret', async () => {
  for (const field of ['MONGODB_URI', 'APP_ORIGIN', 'APP_PASSWORD', 'SESSION_SECRET']) {
    const environment = cloudEnvironment(); delete environment[field];
    await assert.rejects(exported(backend, 'createServer')({environment, store: {}}), new RegExp(field));
  }
  await assert.rejects(exported(backend, 'createServer')({environment: {...cloudEnvironment(), APP_ORIGIN: 'http://benefits.example.test'}, store: {}}), /HTTPS/);
});

test('cloud data requires login; password login sets protected session and logout clears it', async t => {
  const {request, login} = await running(t);
  assert.equal((await request('/healthz', {headers: {Host: 'localhost'}})).status, 200);
  assert.deepEqual(await (await request('/api/session')).json(), {mode: 'cloud', authenticated: false});
  assert.equal((await request('/api/benefits')).status, 401);
  assert.equal((await request('/api/login', {method: 'POST', body: {password: 'wrong'}})).status, 401);
  const response = await login();
  const cookie = response.headers.get('set-cookie');
  for (const flag of ['HttpOnly', 'SameSite=Strict', 'Secure', 'Path=/']) assert.ok(cookie.includes(flag));
  assert.equal((await request('/api/benefits')).status, 200);
  assert.deepEqual(await (await request('/api/session')).json(), {mode: 'cloud', authenticated: true});
  const logout = await request('/api/logout', {method: 'POST', body: {}});
  assert.equal(logout.status, 200);
  assert.ok(logout.headers.get('set-cookie').includes('Max-Age=0'));
});

test('host and origin guards reject proxy mistakes and cross-site writes', async t => {
  const {request} = await running(t);
  assert.equal((await request('/api/session', {headers: {Host: 'evil.example'}})).status, 403);
  assert.equal((await request('/api/login', {method: 'POST', headers: {Origin: 'https://evil.example'}, body: {password: 'test-only-password'}})).status, 403);
  assert.equal((await request('/api/login', {method: 'POST', headers: {'Sec-Fetch-Site': 'cross-site'}, body: {password: 'test-only-password'}})).status, 403);
});

test('save HTTP contract handles first import, exact retry, competing edits, and invalid data', async t => {
  const {request, login} = await running(t); await login();
  const first = await request('/api/benefits', {method: 'POST', body: write()});
  assert.equal(first.status, 200); const snapshot = await first.json();
  assert.equal(snapshot.version, 2); assert.equal(snapshot.initialized, true); assert.equal(snapshot.revision, 1);
  const retry = await request('/api/benefits', {method: 'POST', body: write()});
  assert.deepEqual(await retry.json(), snapshot);
  const conflict = await request('/api/benefits', {method: 'POST', body: write(0, [record('other')], 'other-request')});
  assert.equal(conflict.status, 409); assert.equal((await conflict.json()).code, 'REVISION_CONFLICT');
  const invalid = await request('/api/benefits', {method: 'POST', body: write(1, [{...record(), expires: '2026-02-30'}], 'invalid')});
  assert.equal(invalid.status, 400);
  assert.deepEqual(await (await request('/api/benefits')).json(), snapshot);
});

test('API rejects non-JSON, oversized JSON, and oversized login bodies', async t => {
  const {request, login} = await running(t); await login();
  assert.equal((await request('/api/benefits', {method: 'POST', headers: {'Content-Type': 'text/plain'}, body: '{}'})).status, 415);
  assert.equal((await request('/api/benefits', {method: 'POST', body: 'x'.repeat(4 * 1024 * 1024 + 1)})).status, 413);
  assert.equal((await request('/api/login', {method: 'POST', body: {password: 'x'.repeat(5000)}})).status, 413);
});

test('repeated incorrect passwords are rate limited', async t => {
  const {request} = await running(t);
  for (let attempt = 0; attempt < 6; attempt++) assert.equal((await request('/api/login', {method: 'POST', body: {password: 'wrong'}})).status, 401);
  const blocked = await request('/api/login', {method: 'POST', body: {password: 'wrong'}});
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
});
