// Adapted from Asset's single-password authentication. Benefits has its own
// cookie name, independent credentials, and independent signing secret.
const {createHmac, randomBytes, scrypt: derive, timingSafeEqual} = require('node:crypto');
const {promisify} = require('node:util');
const scrypt = promisify(derive);
const lifetime = 7 * 24 * 60 * 60;
const cookieName = 'benefits_session';

async function createAuth({password, secret, secure, clock = Date.now}) {
  const salt = randomBytes(16), expected = await scrypt(password, salt, 32);
  const sessionKey = createHmac('sha256', secret).update(password).digest();
  const mac = value => createHmac('sha256', sessionKey).update(value).digest('base64url');
  const equal = (left, right) => {
    const a = Buffer.from(left), b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  };
  const clients = new Map();
  let active = 0, globalCount = 0, globalUntil = 0;
  const cookie = (value, seconds) => `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${seconds}${secure ? '; Secure' : ''}`;
  return {
    session(request) {
      const value = (request.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
      if (!value || value.length > 1024) return false;
      const parts = value.split('.');
      if (parts.length !== 2 || !parts[1] || !equal(parts[1], mac(parts[0]))) return false;
      try {
        const saved = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
        return saved.application === 'benefits' && Number.isFinite(saved.expires) && saved.expires > clock();
      } catch { return false; }
    },
    clear: () => cookie('', 0),
    async login(input, address) {
      const now = clock();
      const blocked = until => ({status: 429, retryAfter: Math.max(1, Math.ceil((until - now) / 1000)), error: '登录尝试过于频繁，请稍后重试。'});
      for (const [key, value] of clients) if (!value.active && value.failureUntil <= now && value.attemptUntil <= now) clients.delete(key);
      if (globalUntil <= now) {globalCount = 0; globalUntil = now + 60000;}
      const key = address || 'unknown';
      let client = clients.get(key);
      if (client?.failureUntil <= now) client.failures = 0;
      if (client?.attemptUntil <= now) client.attempts = 0;
      if (client?.failures >= 6) return blocked(client.failureUntil);
      if (client?.attempts >= 10) return blocked(client.attemptUntil);
      if (globalCount >= 60) return blocked(globalUntil);
      if (active >= 4) return blocked(now + 1000);
      if (!client) {
        if (clients.size >= 2000) return blocked(now + 60000);
        client = {failures: 0, failureUntil: 0, attempts: 0, attemptUntil: 0, active: 0};
        clients.set(key, client);
      }
      if (client.failureUntil <= now) client.failureUntil = now + 15 * 60000;
      if (client.attemptUntil <= now) client.attemptUntil = now + 60000;
      // Reserve budgets before reading a request body or starting scrypt.
      client.attempts++; client.failures++; client.active++; globalCount++; active++;
      let matched = false;
      try {
        const body = typeof input === 'function' ? await input() : input;
        if (typeof body?.password !== 'string' || body.password.length > 512) return {status: 401, error: '密码不正确。'};
        matched = timingSafeEqual(await scrypt(body.password, salt, 32), expected);
        if (!matched) return {status: 401, error: '密码不正确。'};
        const payload = Buffer.from(JSON.stringify({application: 'benefits', expires: now + lifetime * 1000, nonce: randomBytes(16).toString('hex')})).toString('base64url');
        return {status: 200, cookie: cookie(payload + '.' + mac(payload), lifetime)};
      } finally {active--; client.active--; if (matched) client.failures = Math.max(0, client.failures - 1);}
    }
  };
}

module.exports = {createAuth};
