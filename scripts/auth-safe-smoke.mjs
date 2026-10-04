import { chromium } from 'playwright';
import {
  TURNSTILE_TEST_SITE_KEY,
  TURNSTILE_TEST_TOKEN,
  assertLoopbackBase,
  installTurnstileTestRoutes,
} from './turnstile-test-helpers.mjs';

const BASE = (process.env.RT_BASE_URL || '').replace(/\/$/, '');
assertLoopbackBase(BASE);

function assert(value, message) {
  if (!value) throw new Error(message);
}

const fakeSupabaseModule = `
const eventKey = 'rt-auth-safe-events';
const log = (type, payload = {}) => {
  const current = JSON.parse(localStorage.getItem(eventKey) || '[]');
  current.push({ type, payload });
  localStorage.setItem(eventKey, JSON.stringify(current));
};
let user = null;
const ok = (data = {}) => ({ data, error: null });
export function createClient() {
  return {
    auth: {
      async signUp(payload) { log('signup', payload); return ok({ user: { id: 'local-signup-user' } }); },
      async signInWithPassword(payload) { user = { id: 'local-login-user', email: payload.email }; log('email-login', payload); return ok({ user, session: { access_token: 'local-access' } }); },
      async setSession(payload) { user = { id: 'local-username-user' }; log('set-session', payload); return ok({ user, session: payload }); },
      async resetPasswordForEmail(email, options) { log('password-reset-request', { email, options }); return ok({}); },
      async updateUser(payload) { user = { id: 'local-password-user' }; log('password-update', payload); return ok({ user }); },
      async getUser() { return ok({ user }); },
      async getSession() { return ok({ session: user ? { user } : null }); },
      onAuthStateChange() { return ok({ subscription: { unsubscribe() {} } }); },
      async signOut() { user = null; return ok({}); },
      mfa: {
        async getAuthenticatorAssuranceLevel() { return ok({ currentLevel: 'aal1', nextLevel: 'aal1' }); },
        async listFactors() { return ok({ totp: [] }); },
      },
    },
  };
}
`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
let usernameRequest = null;

await context.route('https://esm.sh/@supabase/supabase-js@2.112.3*', (route) => route.fulfill({
  status: 200,
  contentType: 'application/javascript; charset=utf-8',
  headers: { 'Access-Control-Allow-Origin': '*' },
  body: fakeSupabaseModule,
}));
await context.route('https://hnsmozvatgyrascxbhys.supabase.co/**', async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/functions/v1/login-username') {
    usernameRequest = JSON.parse(route.request().postData() || '{}');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ access_token: 'local-access', refresh_token: 'local-refresh' }),
    });
  }
  return route.abort('blockedbyclient');
});
await context.route('https://fonts.googleapis.com/**', (route) => route.abort());
await context.route('https://fonts.gstatic.com/**', (route) => route.abort());
await context.route('https://pagead2.googlesyndication.com/**', (route) => route.fulfill({
  status: 200,
  contentType: 'application/javascript',
  body: '',
}));

async function newSafePage() {
  const page = await context.newPage();
  await installTurnstileTestRoutes(page, BASE);
  page.setDefaultTimeout(15000);
  return page;
}

async function events(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('rt-auth-safe-events') || '[]'));
}

try {
  let page = await newSafePage();
  await page.goto(`${BASE}/registro.html?auth_safe=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-turnstile-status="ok"]');
  assert(await page.locator('#turnstile-registro').getAttribute('data-turnstile-test-sitekey') === TURNSTILE_TEST_SITE_KEY, 'Registro no usa la sitekey oficial de prueba');
  await page.fill('#nombre', 'Prueba');
  await page.fill('#apellido', 'Local');
  await page.fill('#usuario', 'prueba.local');
  await page.fill('#email', 'prueba-local@example.test');
  await page.fill('#password', 'LocalPass!2026');
  await page.fill('#password2', 'LocalPass!2026');
  await page.check('#privacidad');
  await page.click('#enviar');
  await page.waitForSelector('#exito.visible');
  let recorded = await events(page);
  const signup = recorded.find((event) => event.type === 'signup');
  assert(signup?.payload?.options?.captchaToken === TURNSTILE_TEST_TOKEN, 'Registro positivo no transmitió el token de prueba');
  await page.close();

  page = await newSafePage();
  await page.goto(`${BASE}/login.html?auth_safe=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-turnstile-status="ok"]');
  await page.fill('#identifier', 'prueba-local@example.test');
  await page.fill('#password', 'LocalPass!2026');
  await page.click('#enviar');
  await page.waitForURL(/\/index\.html(?:\?|$)/);
  recorded = await events(page);
  const emailLogin = recorded.find((event) => event.type === 'email-login');
  assert(emailLogin?.payload?.options?.captchaToken === TURNSTILE_TEST_TOKEN, 'Login por correo no transmitió el token de prueba');
  await page.close();

  page = await newSafePage();
  await page.goto(`${BASE}/login.html?auth_safe=2`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-turnstile-status="ok"]');
  await page.fill('#identifier', 'prueba.local');
  await page.fill('#password', 'LocalPass!2026');
  await page.click('#enviar');
  await page.waitForURL(/\/index\.html(?:\?|$)/);
  assert(usernameRequest?.captchaToken === TURNSTILE_TEST_TOKEN, 'Login por usuario no transmitió el token de prueba');
  recorded = await events(page);
  assert(recorded.some((event) => event.type === 'set-session'), 'Login por usuario no instaló la sesión local');
  await page.close();

  page = await newSafePage();
  await page.goto(`${BASE}/recuperar.html?auth_safe=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-turnstile-status="ok"]');
  await page.fill('#email', 'prueba-local@example.test');
  await page.click('#enviar');
  await page.waitForFunction(() => /recibirás un enlace/i.test(document.querySelector('#estado')?.textContent || ''));
  recorded = await events(page);
  const reset = recorded.find((event) => event.type === 'password-reset-request');
  assert(reset?.payload?.options?.captchaToken === TURNSTILE_TEST_TOKEN, 'Recuperación no transmitió el token de prueba');
  await page.close();

  page = await newSafePage();
  await page.goto(`${BASE}/recuperar.html?modo=nueva&auth_safe=1`, { waitUntil: 'domcontentloaded' });
  await page.fill('#password', 'NuevaLocalPass!2026');
  await page.fill('#password2', 'NuevaLocalPass!2026');
  await page.click('#guardar');
  await page.waitForURL(/login\.html\?password=actualizada/);
  recorded = await events(page);
  assert(recorded.some((event) => event.type === 'password-update'), 'Actualización positiva de contraseña no se ejecutó');
  await page.close();
} finally {
  await browser.close();
}

console.log('AUTH SAFE PASS · registro + login correo + login usuario + solicitud/actualización de contraseña · Supabase local simulado · Turnstile oficial de prueba');
