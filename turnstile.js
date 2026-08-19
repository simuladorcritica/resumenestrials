import { TURNSTILE_SITE_KEY } from './turnstile-config.js?v=3';

let scriptPromise = null;

function loadScript() {
  if (!TURNSTILE_SITE_KEY) return Promise.resolve(false);
  if (window.turnstile) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('No fue posible descargar Cloudflare Turnstile.'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function turnstileEnabled() {
  return Boolean(TURNSTILE_SITE_KEY);
}

export async function mountTurnstile(containerId, action) {
  if (!TURNSTILE_SITE_KEY) {
    return { enabled: false, getToken: () => null, reset: () => {} };
  }

  const container = document.getElementById(containerId);
  if (!container) throw new Error('No se encontró el contenedor de seguridad.');

  container.innerHTML = '<div style="font:11px IBM Plex Mono,monospace;color:#38506e;padding:10px 0">Cargando verificación de seguridad…</div>';

  await loadScript();
  if (!window.turnstile?.render) throw new Error('La API de Turnstile no quedó disponible.');

  container.innerHTML = '';
  let token = null;

  const widgetId = window.turnstile.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    theme: 'light',
    size: 'normal',
    appearance: 'always',
    execution: 'render',
    action,
    callback: (value) => {
      token = value;
      container.dataset.turnstileStatus = 'ok';
    },
    'expired-callback': () => {
      token = null;
      container.dataset.turnstileStatus = 'expired';
    },
    'timeout-callback': () => {
      token = null;
      container.dataset.turnstileStatus = 'timeout';
    },
    'error-callback': (code) => {
      token = null;
      container.dataset.turnstileStatus = 'error';
      container.dataset.turnstileError = String(code || 'unknown');
      console.error('Turnstile error:', code);
    },
    'refresh-expired': 'auto',
    retry: 'auto'
  });

  if (widgetId === undefined || widgetId === null) {
    throw new Error('Cloudflare no pudo crear el widget de seguridad.');
  }

  return {
    enabled: true,
    getToken: () => token || window.turnstile?.getResponse?.(widgetId) || null,
    reset: () => {
      token = null;
      window.turnstile?.reset?.(widgetId);
    }
  };
}
