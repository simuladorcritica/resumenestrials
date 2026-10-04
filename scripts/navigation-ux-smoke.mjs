import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const base = process.env.RT_BASE_URL || 'http://127.0.0.1:8890';
const local = Boolean(process.env.RT_BASE_URL);
const originalIndex = local ? readFileSync('index.html', 'utf8') : '';
if (local) {
  const modules = '<script type="module" src="/home-auth-ui.js?v=8"></script><script type="module" src="/interactive-home.js?v=20260819.4"></script><script type="module" src="/recommendations.js?v=2"></script><script src="/specialty-classification.js?v=2"></script><script type="module" src="/internal-medicine-ux.js?v=2"></script><script type="module" src="/home-visual-tuning.js?v=1"></script><script src="/pdf-contact.js?v=2" defer></script><script src="/home-control-layout.js?v=1" defer></script>';
  writeFileSync('index.html', readFileSync('_includes/index-source.html', 'utf8').replace('</body>', `${modules}</body>`), 'utf8');
  process.once('exit', () => writeFileSync('index.html', originalIndex, 'utf8'));
}
const browser = await chromium.launch({ headless: true });

async function pageAt(path, viewport = { width: 390, height: 844 }) {
  const page = await browser.newPage({ viewportSize: viewport });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/ERR_NETWORK_ACCESS_DENIED/.test(message.text())) errors.push(message.text()); });
  if (local) {
    const anonymousAuth = `export function createClient(){return {auth:{async getUser(){return {data:{user:null},error:null}},async getSession(){return {data:{session:null},error:null}},onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}},error:null}},mfa:{async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:null,nextLevel:null},error:null}},async listFactors(){return {data:{totp:[]},error:null}}}}}}`;
    await page.route('https://esm.sh/@supabase/supabase-js@2.112.3*', route => route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: anonymousAuth }));
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', route => route.fulfill({ status: 204, body: '' }));
  }
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  return { page, errors };
}

try {
  {
    const { page, errors } = await pageAt('/');
    assert.equal(await page.locator('.rt-main-nav').count(), 1, 'Debe existir una sola navegación principal');
    assert.equal(await page.locator('.rt-main-nav a').count(), 4, 'La navegación principal debe tener cuatro destinos');
    assert.equal(await page.locator('.rt-mobile-bar').count(), 1, 'Debe existir la barra móvil');
    assert.equal(await page.locator('#q').isVisible(), true, 'La búsqueda debe ser visible');
    assert.equal(await page.locator('.filtros').isVisible(), true, 'Los filtros deben ser visibles');
    await page.waitForTimeout(3000);
    assert.equal(await page.locator('#rt-advanced').count(), 1, `Deben existir los filtros avanzados. ${errors.join('; ')}`);
    const advanced = page.locator('#rt-advanced');
    assert.equal(await advanced.evaluate(el => getComputedStyle(el).display !== 'none'), true, 'Los filtros avanzados deben ser visibles');
    const visibleCards = await page.locator('.fila:not([hidden])').count();
    assert.ok(visibleCards > 0 && visibleCards <= 24, `Deben verse hasta 24 tarjetas; se encontraron ${visibleCards}`);
    assert.equal(await page.locator('#rt-show-more').count(), 1, 'Debe existir Mostrar más');
    await page.locator('#q').fill('semaglutida');
    await page.waitForTimeout(250);
    assert.match(page.url(), /[?&]q=semaglutida/);
    assert.deepEqual(errors, [], `Errores en portada: ${errors.join('; ')}`);
    await page.close();
  }

  {
    const { page, errors } = await pageAt('/trials/a-close-clopidogrel-monoterapia-doble-antiagregacion-prolongada-tras-stent-farmacoactivo/');
    assert.equal(await page.locator('.rt-reader-toolbar').count(), 1, 'Debe existir una barra persistente de lectura');
    assert.equal(await page.locator('.rt-mobile-bar').count(), 0, 'La barra general no debe competir con la barra del lector');
    assert.equal(await page.locator('.rt-reader-toolbar [data-sections]').count(), 1, 'Debe existir el control de secciones');
    assert.equal(await page.locator('.rt-reader-toolbar [data-pdf]').count(), 1, 'Debe existir una sola acción PDF activa');
    assert.equal(await page.locator('footer [data-trial-download], footer .btn-pdf').count(), 0, 'El pie no debe duplicar la descarga PDF');
    await page.locator('[data-sections]').click();
    assert.equal(await page.locator('.rt-sections-panel').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.rt-sections-panel').isHidden(), true);
    assert.equal(await page.locator('.pie-nav[data-rt-neighbors="1"]').count(), 1, 'Debe existir continuidad de lectura');
    assert.deepEqual(errors, [], `Errores en lector: ${errors.join('; ')}`);
    await page.close();
  }

  {
    const { page, errors } = await pageAt('/biblioteca.html');
    assert.equal(new URL(page.url()).pathname, '/biblioteca.html', 'La biblioteca no debe redirigir al visitante');
    await page.locator('[data-library-state="signed-out"]').waitFor();
    assert.equal(await page.locator('[data-library-state="signed-out"]').count(), 1, 'Debe explicar el valor de la biblioteca sin sesión');
    assert.equal(await page.locator('[data-library-state="signed-out"] a[href*="login"]').count(), 1, 'Debe ofrecer iniciar sesión');
    assert.equal(await page.locator('[data-library-state="signed-out"] a[href*="registro"]').count(), 1, 'Debe ofrecer crear cuenta');
    assert.deepEqual(errors, [], `Errores en biblioteca: ${errors.join('; ')}`);
    await page.close();
  }

  console.log('PASS navigation UX smoke');
} finally {
  await browser.close();
}
