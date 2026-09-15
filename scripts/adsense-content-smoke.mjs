import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const advertising = url => /adsbygoogle|ca-pub-3132744538918477/.test(url)
  || /(^|\.)(googlesyndication\.com|doubleclick\.net|googleadservices\.com)$/.test(new URL(url).hostname);

export async function checkContentAdvertising(base, output = 'future-screenshots') {
  const manifest = await (await fetch(base + '/seo-manifest.json')).json();
  const moved = '/medicina-interna/hematologia-oncologia/';
  const cases = [
    ['/resumen.html?id=98', true], ['/resumen.html?id=98&v=corto', true],
    ['/resumen.html', false], ['/resumen.html?id=999999', false],
    ['/agregar.html', false], [moved, false], ['/', true], [manifest['98'].path, true],
  ];
  const browser = await chromium.launch({ headless: true, ...(process.env.RT_CHROME_CHANNEL ? { channel: process.env.RT_CHROME_CHANNEL } : {}) });
  const rows = [];
  mkdirSync(output, { recursive: true });
  try {
    for (const width of [390, 1440]) for (const [path, allowed] of cases) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      // Python's local server cannot render the Jekyll include. Serve the same
      // authoritative home source without changing the checkout or public QA.
      if (path === '/' && ['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
        await context.route(base + '/', route => route.fulfill({ contentType: 'text/html', body: readFileSync('_includes/index-source.html', 'utf8') }));
      }
      const requests = [], errors = [], consoleMessages = [], failedResponses = [];
      context.on('request', r => requests.push({ url: r.url(), document: r.frame().url() }));
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => consoleMessages.push({ type: m.type(), text: m.text() }));
      page.on('response', r => { if (r.status() >= 400) failedResponses.push({ url: r.url(), status: r.status() }); });
      let releaseData;
      const dataGate = new Promise(resolve => { releaseData = resolve; });
      if (path.startsWith('/resumen.html')) {
        await page.route('**/resumenes.json*', async route => { await dataGate; await route.continue(); });
      }
      await page.goto(base + path, { waitUntil: 'domcontentloaded' });
      if (path.startsWith('/resumen.html')) {
        await page.waitForTimeout(250);
        assert.equal(requests.filter(r => advertising(r.url)).length, 0, path + ': advertising before article validation');
        releaseData();
      }
      if (path === moved) await page.waitForURL(url => url.pathname === '/medicina-interna/');
      if (path.startsWith('/resumen.html')) {
        await page.locator(allowed ? 'article' : '.aviso').first().waitFor({ state: 'visible' });
      }
      if (allowed || path === moved) await page.waitForFunction(() => document.querySelectorAll('script[src*="adsbygoogle.js"]').length === 1);
      await page.waitForTimeout(800);
      const ads = requests.filter(r => advertising(r.url));
      const loaders = await page.locator('script[src*="adsbygoogle.js"]').count();
      const originAds = path === moved ? ads.filter(r => r.document && new URL(r.document).pathname === moved) : ads;
      assert.equal(loaders, allowed || path === moved ? 1 : 0, path + ': final loader count');
      assert.equal(originAds.filter(r => r.url.includes('/pagead/js/adsbygoogle.js')).length, allowed ? 1 : 0, path + ': origin loader requests');
      if (!allowed) assert.deepEqual(originAds, [], path + ': forbidden advertising requests');
      if (path === '/agregar.html') assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
      assert.deepEqual(errors, [], path + ': page errors');
      assert.equal(consoleMessages.some(m => /AdSense head tag doesn't support/.test(m.text)), false, path + ': unsupported advertising attribute');
      const dom = await page.evaluate(() => ({ title: document.title, text: document.body.innerText, robots: document.querySelector('meta[name="robots"]')?.content, canonical: document.querySelector('link[rel="canonical"]')?.href, overflow: document.documentElement.scrollWidth > innerWidth + 2 }));
      assert.equal(dom.overflow, false, path + ': horizontal overflow');
      rows.push({ path, width, finalUrl: page.url(), allowed, loaders, originAds, requests, failedResponses, errors, consoleMessages, dom });
      await page.screenshot({ path: output + '/content-ads-' + rows.length + '.png' });
      await context.close();
    }
    // Isolate the redirecting document: its destination may legitimately show ads.
    // No advertising request is blocked or mocked, only the destination HTML.
    const context = await browser.newContext(); const requested = [];
    context.on('request', r => { if (advertising(r.url())) requested.push(r.url()); });
    await context.route('**/medicina-interna/', route => route.fulfill({ contentType: 'text/html', body: '<h1>Redirect destination control</h1>' }));
    const page = await context.newPage(); await page.goto(base + moved); await page.waitForURL(url => url.pathname === '/medicina-interna/'); await page.waitForTimeout(500);
    assert.deepEqual(requested, [], 'Redirect origin must not initiate any advertising');
    rows.push({ case: 'redirect-origin-isolation', requested, finalUrl: page.url() });
    await context.close();
  } finally { await browser.close(); }
  writeFileSync(output + '/adsense-content.json', JSON.stringify(rows, null, 2));
  console.log('ADSENSE CONTENT PASS: 16 route/viewport cases, delayed-data gate and isolated redirect origin');
}
