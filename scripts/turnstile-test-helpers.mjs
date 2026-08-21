export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
export const TURNSTILE_TEST_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

export function assertLoopbackBase(base) {
  const url = new URL(base);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error(`Las rutas de prueba Turnstile solo pueden instalarse en loopback: ${url.origin}`);
  }
  return url.origin;
}

export async function installTurnstileTestRoutes(page, base) {
  const origin = assertLoopbackBase(base);
  await page.route('**/turnstile-config.js*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin !== origin) return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      headers: { 'Cache-Control': 'no-store' },
      body: `export const TURNSTILE_SITE_KEY = ${JSON.stringify(TURNSTILE_TEST_SITE_KEY)};`,
    });
  });
  await page.route('https://challenges.cloudflare.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: `(() => {
      const expected = ${JSON.stringify(TURNSTILE_TEST_SITE_KEY)};
      const token = ${JSON.stringify(TURNSTILE_TEST_TOKEN)};
      const responses = new Map();
      let nextId = 1;
      window.turnstile = {
        render(element, options = {}) {
          if (options.sitekey !== expected) {
            queueMicrotask(() => options['error-callback']?.('110100'));
            return null;
          }
          const id = 'ci-turnstile-' + nextId++;
          responses.set(id, token);
          element.dataset.turnstileTestSitekey = options.sitekey;
          queueMicrotask(() => options.callback?.(token));
          return id;
        },
        getResponse(id) { return responses.get(id) || ''; },
        reset(id) { if (id) responses.set(id, token); },
      };
    })();`,
  }));
}
