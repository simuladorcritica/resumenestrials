import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { assertLoopbackBase, installTurnstileTestRoutes } from './turnstile-test-helpers.mjs';
import { checkContentAdvertising } from './adsense-content-smoke.mjs';

const BASE = (process.env.RT_BASE_URL || '').replace(/\/$/, '');
assertLoopbackBase(BASE);
const paths = ['/login.html', '/registro.html', '/recuperar.html', '/cuenta.html', '/biblioteca.html',
  '/privacidad/', '/privacidad/index.html', '/privacidad.html', '/terminos/', '/terminos/index.html'];
const anonymousModule = `export function createClient(){return {auth:{
  async getUser(){return {data:{user:null},error:null}},
  async getSession(){return {data:{session:null},error:null}},
  onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}},error:null}},
  mfa:{async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:null,nextLevel:null},error:null}},
       async listFactors(){return {data:{totp:[]},error:null}}}
}}}`;
// Match advertising hosts, not Google OAuth, reCAPTCHA or Cloudflare Turnstile.
function advertising(url) {
  const parsed = new URL(url);
  return /adsbygoogle|ca-pub-3132744538918477/.test(url)
    || /(^|\.)(googlesyndication\.com|doubleclick\.net|googleadservices\.com)$/.test(parsed.hostname);
}
const browser = await chromium.launch({ headless: true });
const results = [];
mkdirSync('future-screenshots', { recursive: true });
try {
  for (const width of [390, 1440]) {
    for (const path of paths) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      const requests = [], errors = [];
      // Observe from before the first navigation, including requests before redirects.
      context.on('request', request => requests.push(request.url()));
      await context.route('https://esm.sh/@supabase/supabase-js@2.112.3*', route => route.fulfill({
        contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: anonymousModule,
      }));
      const page = await context.newPage();
      await installTurnstileTestRoutes(page, BASE);
      page.on('pageerror', error => errors.push(error.message));
      // No advertising request is mocked, blocked or fulfilled by this test.
      const response = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200, path);
      if (['/cuenta.html', '/biblioteca.html'].includes(path)) await page.waitForURL(/\/login\.html/);
      if (path === '/privacidad.html') await page.waitForURL(/\/privacidad\/$/);
      await page.locator('h1').first().waitFor({ state: 'visible' });
      await page.waitForTimeout(700);
      assert.deepEqual(requests.filter(advertising), [], `${path}: advertising requested before/after redirect`);
      assert.equal(await page.locator('script[src*="adsbygoogle"],script[src*="ca-pub-"]').count(), 0, path);
      assert.deepEqual(errors, [], `${path}: browser errors`);
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      assert.ok(dimensions.html <= width + 2 && dimensions.body <= width + 2, `${path}: horizontal overflow at ${width}`);
      if (/login|registro|recuperar|cuenta|biblioteca/.test(path)) {
        assert.ok(requests.some(url => url.includes('esm.sh/@supabase/supabase-js')), `${path}: Supabase module not requested`);
      }
      const filename = path.replace(/[^a-z0-9]/gi, '_');
      await page.screenshot({ path: `future-screenshots/adsense-${filename}-${width}.png` });
      results.push({ path, width, finalPath: new URL(page.url()).pathname, advertisingRequests: 0, errors, dimensions });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync('future-screenshots/adsense-routes.json', JSON.stringify(results, null, 2));
console.log(`ADSENSE ROUTES PASS · ${results.length} route/viewport cases · zero advertising, including anonymous redirects · 390/1440 px`);
await checkContentAdvertising(BASE);
