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
  if (!supabase) {
    throw new Error("Supabase todavía no está configurado en este entorno.");
  }
}

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function validUsername(value) {
  return /^[a-z0-9._-]{3,30}$/.test(normalizeUsername(value));
}

export async function signUpUser({ firstName, lastName, username, email, password, newsletterOptIn }) {
  assertSupabaseConfigured();
  const cleanUsername = normalizeUsername(username);

  if (!validUsername(cleanUsername)) {
    throw new Error("El nombre de usuario debe tener entre 3 y 30 caracteres y usar solo letras, números, punto, guion o guion bajo.");
  }

  const { data, error } = await supabase.auth.signUp({
    email: String(email || "").trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: "https://resumenestrials.com/login.html?confirmado=1",
      data: {
        first_name: String(firstName || "").trim(),
        last_name: String(lastName || "").trim(),
        username: cleanUsername,
        newsletter_opt_in: Boolean(newsletterOptIn)
      }
    }
  });

  if (error) throw error;
  return data;
}

export async function signInUser({ email, password }) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || "").trim().toLowerCase(),
    password
  });
  if (error) throw error;
  return data;
}

export async function requestPasswordReset(email) {
  assertSupabaseConfigured();
  const { data, error } = await supabase.auth.resetPasswordForEmail(
    String(email || "").trim().toLowerCase(),
    { redirectTo: "https://resumenestrials.com/recuperar.html?modo=nueva" }
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
