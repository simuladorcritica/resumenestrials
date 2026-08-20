import { randomBytes } from 'node:crypto';

const PROJECT_REF = process.env.PROJECT_REF || 'hnsmozvatgyrascxbhys';
const SUPABASE_URL = process.env.SUPABASE_URL || `https://${PROJECT_REF}.supabase.co`;
const PUBLIC_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_IfNh1tBO7c5c5u9Kc5_qSQ_QFHHY7wK';
const MANAGEMENT_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';
const SITE_URL = 'https://resumenestrials.com';

function assert(value, message) {
  if (!value) throw new Error(message);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(response, label) {
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`${label}: respuesta no JSON (HTTP ${response.status})`); }
  if (!response.ok) {
    const detail = payload?.message || payload?.error || payload?.msg || `HTTP ${response.status}`;
    throw new Error(`${label}: ${detail}`);
  }
  return payload;
}

async function management(path, options = {}) {
  assert(MANAGEMENT_TOKEN, 'Falta SUPABASE_ACCESS_TOKEN');
  const response = await fetch(`https://api.supabase.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${MANAGEMENT_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  return readJson(response, `Management API ${path}`);
}

function parseAllowList(value) {
  return String(value || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function backendHeaders(key) {
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  // Las nuevas sb_secret_* se envían únicamente en apikey. Las claves legacy
  // service_role siguen aceptando Authorization Bearer.
  if (!String(key).startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function passwordLoginWithPropagation(email, password) {
  let lastDetail = '';
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: PUBLIC_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch {}
    if (response.ok && payload?.access_token && payload?.refresh_token) return payload;
    lastDetail = payload?.message || payload?.error_description || payload?.error || payload?.msg || `HTTP ${response.status}`;
    if (!/captcha protection/i.test(lastDetail)) {
      throw new Error(`Inicio de sesión por correo: ${lastDetail}`);
    }
    console.log(`Esperando propagación de Auth (${attempt}/12)…`);
    await sleep(5000);
  }
  throw new Error(`Inicio de sesión por correo: ${lastDetail || 'la configuración CAPTCHA no se propagó'}`);
}

async function main() {
  const before = await management(`/v1/projects/${PROJECT_REF}/config/auth`);
  assert(before.disable_signup !== true, 'Supabase tiene desactivado el registro de usuarios');
  assert(before.external_email_enabled !== false, 'Supabase tiene desactivado el proveedor de correo');

  const allow = new Set(parseAllowList(before.uri_allow_list));
  allow.add(`${SITE_URL}/**`);

  const after = await management(`/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    body: JSON.stringify({
      security_captcha_enabled: false,
      site_url: `${SITE_URL}/`,
      uri_allow_list: [...allow].join(',')
    })
  });
  assert(after.security_captcha_enabled === false, 'Supabase no desactivó el CAPTCHA con secreto inválido');
  assert(String(after.site_url || '').startsWith(SITE_URL), 'Site URL de Auth no apunta a resumenestrials.com');
  assert(parseAllowList(after.uri_allow_list).some((x) => x.startsWith(SITE_URL)), 'Falta resumenestrials.com en Redirect URLs');

  const keys = await management(`/v1/projects/${PROJECT_REF}/api-keys?reveal=true`);
  assert(Array.isArray(keys), 'No fue posible leer las API keys del proyecto');
  const legacyService = keys.find((k) => k.type === 'legacy' && k.name === 'service_role' && k.api_key);
  const modernSecret = keys.find((k) => k.type === 'secret' && k.api_key && (k.secret_jwt_template?.role === 'service_role' || k.name === 'default'));
  const serverKey = legacyService?.api_key || modernSecret?.api_key;
  assert(serverKey, 'No se encontró una clave servidor para la prueba de Auth');

  const suffix = `${Date.now()}${randomBytes(3).toString('hex')}`.slice(-18);
  const username = `rt_smoke_${suffix}`.slice(0, 30).toLowerCase();
  const email = `rt-auth-${suffix}@example.com`;
  const password = `Rt!${randomBytes(18).toString('base64url')}9a`;
  let userId = null;

  try {
    const createResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: backendHeaders(serverKey),
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: 'RT',
          last_name: 'Smoke',
          username,
          newsletter_opt_in: false
        }
      })
    });
    const created = await readJson(createResponse, 'Crear usuario temporal');
    userId = created?.id || created?.user?.id;
    assert(userId, 'La creación del usuario temporal no devolvió id');

    const login = await passwordLoginWithPropagation(email, password);

    const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,username,email&id=eq.${encodeURIComponent(userId)}`, {
      headers: {
        apikey: PUBLIC_KEY,
        Authorization: `Bearer ${login.access_token}`,
        Accept: 'application/json'
      }
    });
    const profiles = await readJson(profileResponse, 'Leer perfil del usuario temporal');
    assert(Array.isArray(profiles) && profiles.length === 1, 'El trigger de perfiles/RLS no devolvió el perfil del usuario');
    assert(profiles[0].username === username, 'El perfil no conserva el nombre de usuario esperado');

    const usernameResponse = await fetch(`${SUPABASE_URL}/functions/v1/login-username`, {
      method: 'POST',
      headers: {
        apikey: PUBLIC_KEY,
        'Content-Type': 'application/json',
        Origin: SITE_URL
      },
      body: JSON.stringify({ username, password, captchaToken: null })
    });
    const usernameLogin = await readJson(usernameResponse, 'Inicio de sesión por nombre de usuario');
    assert(usernameLogin.access_token && usernameLogin.refresh_token, 'El acceso por nombre de usuario no devolvió sesión');

    console.log('AUTH PRODUCTION PASS');
    console.log('captcha=disabled-until-valid-secret');
    console.log('email-login=pass');
    console.log('username-login=pass');
    console.log('profiles-trigger-and-rls=pass');
    console.log('redirect-config=pass');
  } finally {
    if (userId && serverKey) {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: backendHeaders(serverKey)
      });
      if (!response.ok) console.warn(`No se pudo borrar el usuario temporal (HTTP ${response.status})`);
    }
  }
}

main().catch((error) => {
  console.error(`AUTH PRODUCTION FAIL: ${error.message}`);
  process.exit(1);
});
