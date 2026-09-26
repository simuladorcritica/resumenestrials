import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../turnstile.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/m, 'const TURNSTILE_SITE_KEY = "isolated-test-key";')
  .replace(/export /g, '');

class Element {
  constructor() { this.children = []; this.dataset = {}; this.style = {}; this.attrs = {}; this.textContent = ''; }
  hasAttribute(key) { return key in this.attrs; }
  setAttribute(key, value) { this.attrs[key] = value; }
  removeAttribute(key) { delete this.attrs[key]; }
  replaceChildren(...children) { this.children = children; }
  after(node) { this.notice = node; }
}

async function fixture() {
  const container = new Element(), widget = new Element();
  let options, resetId;
  const sandbox = { document: { getElementById: () => container, createElement: () => new Element() },
    console: { error() {} }, window: { turnstile: {
      render(element, settings) { options = settings; element.children.push(widget); return 'test-widget'; },
      getResponse() { return ''; }, reset(id) { resetId = id; }
    } } };
  vm.createContext(sandbox);
  vm.runInContext(source + '\nthis.mount = mountTurnstile;', sandbox);
  const api = await sandbox.mount('verification', 'login');
  return { container, widget, options, api, resetId: () => resetId };
}

test('an error and repeated retries preserve the mounted verification widget', async () => {
  const { container, widget, options, api } = await fixture();
  for (const code of ['300030', '300030', '600010']) {
    options['error-callback'](code);
    assert.ok(container.children.includes(widget), 'the error message must not remove the widget');
    assert.equal(api.getToken(), null);
  }
  assert.equal(options.retry, 'auto');
  assert.equal(container.notice.hidden, false);
  assert.match(container.notice.textContent, /600010/);
  assert.equal(container.notice.attrs.role, 'status');
});

test('successful verification clears the error and preserves expiry and reset', async () => {
  const { container, options, api, resetId } = await fixture();
  options['error-callback']('300030');
  options.callback('isolated-response');
  assert.equal(api.getToken(), 'isolated-response');
  assert.equal(container.dataset.turnstileError, undefined);
  assert.equal(container.notice.hidden, true);
  assert.equal(container.notice.textContent, '');
  options['expired-callback']();
  assert.equal(api.getToken(), null);
  options.callback('second-response');
  api.reset();
  assert.equal(resetId(), 'test-widget');
  assert.equal(api.getToken(), null);
});
