import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const configured = !SUPABASE_URL.includes("TU-PROYECTO") && !SUPABASE_PUBLISHABLE_KEY.includes("TU_PUBLISHABLE_KEY");

export const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export function assertSupabaseConfigured() {
  if (!supabase) throw new Error("Supabase todavía no está configurado en este entorno.");
}

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function validUsername(value) {
  return /^[a-z0-9._-]{3,30}$/.test(normalizeUsername(value));
}

export async function signUpUser({ firstName, lastName, username, email, password, newsletterOptIn, captchaToken }) {
  assertSupabaseConfigured();
  const cleanUsername = normalizeUsername(username);
  if (!validUsername(cleanUsername)) {
    throw new Error("El nombre de usuario debe tener entre 3 y 30 caracteres y usar solo letras, números, punto, guion o guion bajo.");
  }

  const options = {
    emailRedirectTo: "https://resumenestrials.com/login.html?confirmado=1",
    data: {
      first_name: String(firstName || "").trim(),
      last_name: String(lastName || "").trim(),
      username: cleanUsername,
      newsletter_opt_in: Boolean(newsletterOptIn)
    }
  };
  if (captchaToken) options.captchaToken = captchaToken;

  const { data, error } = await supabase.auth.signUp({
    email: String(email || "").trim().toLowerCase(),
    password,
    options
  });
  if (error) throw error;
  return data;
}

export async function signInUser({ identifier, email, password, captchaToken }) {
  assertSupabaseConfigured();
  const id = String(identifier ?? email ?? "").trim();
  if (!id) throw new Error("Escribe tu correo electrónico o nombre de usuario.");

  if (id.includes("@")) {
    const options = captchaToken ? { captchaToken } : undefined;
    const credentials = { email: id.toLowerCase(), password };
    if (options) credentials.options = options;
    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw error;
    return data;
  }

  const username = normalizeUsername(id);
  if (!validUsername(username)) throw new Error("Correo, usuario o contraseña incorrectos.");

  const response = await fetch(`${SUPABASE_URL}/functions/v1/login-username`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify({ username, password, captchaToken: captchaToken || null })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token || !payload?.refresh_token) {
    throw new Error(payload?.error || "Correo, usuario o contraseña incorrectos.");
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token
  });
  if (error) throw error;
  return data;
}

export async function getMfaLoginState() {
  assertSupabaseConfigured();
  const user = await currentUser().catch(() => null);
  if (!user) return { requiresMfa: false, factorId: null, currentLevel: null, nextLevel: null };

  const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors()
  ]);
  if (assuranceError) throw assuranceError;
  if (factorsError) throw factorsError;

  const verifiedTotp = (factors?.totp || []).find((factor) => factor.status === "verified") || null;
  const currentLevel = assurance?.currentLevel || null;
  const nextLevel = assurance?.nextLevel || null;
  const requiresMfa = Boolean(verifiedTotp && nextLevel === "aal2" && currentLevel !== "aal2");
  return {
    requiresMfa,
    factorId: verifiedTotp?.id || null,
    currentLevel,
    nextLevel
  };
}

export async function verifyMfaLoginCode(code, factorId = null) {
  assertSupabaseConfigured();
  const cleanCode = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanCode)) throw new Error("Escribe el código de 6 dígitos de tu aplicación autenticadora.");

  let targetFactorId = factorId;
  if (!targetFactorId) {
    const state = await getMfaLoginState();
    targetFactorId = state.factorId;
  }
  if (!targetFactorId) throw new Error("No encontramos un segundo factor verificado para esta cuenta.");

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: targetFactorId });
  if (challengeError) throw challengeError;
  const challengeId = challenge?.id;
  if (!challengeId) throw new Error("No fue posible iniciar la verificación en dos pasos.");

  const { data, error } = await supabase.auth.mfa.verify({
    factorId: targetFactorId,
    challengeId,
    code: cleanCode
  });
  if (error) throw error;

  const state = await getMfaLoginState();
  if (state.requiresMfa || state.currentLevel !== "aal2") {
    throw new Error("No fue posible completar la verificación en dos pasos.");
  }
  return data;
}

export async function requestPasswordReset(email, captchaToken) {
  assertSupabaseConfigured();
  const options = { redirectTo: "https://resumenestrials.com/recuperar.html?modo=nueva" };
  if (captchaToken) options.captchaToken = captchaToken;
  const { data, error } = await supabase.auth.resetPasswordForEmail(
    String(email || "").trim().toLowerCase(),
    options
  );
  if (error) throw error;
  return data;
}

export async function updatePassword(password) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function signOutUser() {
  assertSupabaseConfigured();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function currentUser() {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getProfile() {
  const user = await currentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, username, email, newsletter_opt_in, newsletter_opt_in_at, created_at, updated_at")
    .eq("id", user.id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile({ firstName, lastName, username, newsletterOptIn }) {
  assertSupabaseConfigured();
  const user = await currentUser();
  if (!user) throw new Error("Debes iniciar sesión.");
  const cleanUsername = normalizeUsername(username);
  if (!validUsername(cleanUsername)) {
    throw new Error("El nombre de usuario debe tener entre 3 y 30 caracteres y usar solo letras, números, punto, guion o guion bajo.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("newsletter_opt_in, newsletter_opt_in_at")
    .eq("id", user.id)
    .single();
  if (existingError) throw existingError;

  const optIn = Boolean(newsletterOptIn);
  const newsletterOptInAt = optIn
    ? (existing?.newsletter_opt_in_at || new Date().toISOString())
    : null;

  const { data, error } = await supabase
    .from("profiles")
    .update({
      first_name: String(firstName || "").trim(),
      last_name: String(lastName || "").trim(),
      username: cleanUsername,
      newsletter_opt_in: optIn,
      newsletter_opt_in_at: newsletterOptInAt
    })
    .eq("id", user.id)
    .select("id, first_name, last_name, username, email, newsletter_opt_in, newsletter_opt_in_at, created_at, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function getAccountPreferences() {
  const user = await currentUser();
  if (!user) throw new Error("Debes iniciar sesión.");
  const meta = user.user_metadata || {};
  return {
    notifications: meta.notifications || {},
    preferences: meta.preferences || {}
  };
}

export async function updateAccountPreferences({ notifications, preferences }) {
  assertSupabaseConfigured();
  const user = await currentUser();
  if (!user) throw new Error("Debes iniciar sesión.");
  const current = user.user_metadata || {};
  const data = { ...current };
  if (notifications) data.notifications = { ...(current.notifications || {}), ...notifications };
  if (preferences) data.preferences = { ...(current.preferences || {}), ...preferences };
  const { data: result, error } = await supabase.auth.updateUser({ data });
  if (error) throw error;
  return result.user;
}
