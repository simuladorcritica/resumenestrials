// Cloudflare Turnstile para resumenestrials.com.
import { TURNSTILE_SITE_KEY } from './turnstile-config.js';
const CAPTCHA_ENABLED = Boolean(TURNSTILE_SITE_KEY && !TURNSTILE_SITE_KEY.includes('TU_SITE_KEY'));

let scriptPromise = null;

function loadScript() {
  if (!CAPTCHA_ENABLED) return Promise.resolve(false);
  if (window.turnstile?.render) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile?.render) resolve(true);
      else reject(new Error('Cloudflare Turnstile no quedó disponible después de cargar el script.'));
    };
    script.onerror = () => reject(new Error('No fue posible descargar Cloudflare Turnstile.'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function turnstileEnabled() {
  return CAPTCHA_ENABLED;
}

export async function mountTurnstile(containerId, action) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error('No se encontró el contenedor de seguridad.');

  if (!CAPTCHA_ENABLED) {
    container.replaceChildren();
    container.hidden = true;
    container.setAttribute('aria-hidden', 'true');
    container.dataset.turnstileStatus = 'disabled';
    return {
      enabled: false,
      getToken: () => null,
      reset: () => {}
    };
  }

  container.hidden = false;
  container.removeAttribute('aria-hidden');
  const status = document.createElement('div');
  status.style.cssText = 'font:11px IBM Plex Mono,monospace;color:#38506e;padding:10px 0';
  status.textContent = 'Cargando verificación de seguridad…';
  container.replaceChildren(status);

  await loadScript();
  container.replaceChildren();

  let token = null;
  let widgetId = null;

  widgetId = window.turnstile.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    theme: 'light',
    size: 'normal',
    appearance: 'always',
    execution: 'render',
    action,
    callback: (value) => {
      token = value;
      container.dataset.turnstileStatus = 'ok';
      delete container.dataset.turnstileError;
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
      const value = String(code || 'desconocido');
      container.dataset.turnstileStatus = 'error';
      container.dataset.turnstileError = value;
      console.error('Cloudflare Turnstile error:', value);
      const message = document.createElement('div');
      message.style.cssText = 'font:11px IBM Plex Mono,monospace;color:#a3311f;padding:10px 0';
      message.textContent = `No se pudo cargar la verificación de seguridad (código ${value}).`;
      container.replaceChildren(message);
      return true;
    },
    'refresh-expired': 'auto',
    retry: 'auto',
    'retry-interval': 3000
  });

  if (widgetId === undefined || widgetId === null) {
    throw new Error('Cloudflare no pudo crear el widget de seguridad.');
  }

  return {
    enabled: true,
    getToken: () => token || window.turnstile?.getResponse?.(widgetId) || null,
    reset: () => {
      token = null;
      if (widgetId !== null) window.turnstile?.reset?.(widgetId);
    }
  };
}
