import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://resumenestrials.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function validateTurnstile(token: string, req: Request) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return true; // Se exigirá cuando configuremos el secreto en Supabase.
  if (!token) return false;

  const remoteip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, response: token, remoteip }),
  });
  const result = await response.json();
  return Boolean(result?.success) && (!result.action || result.action === "login") && (!result.hostname || result.hostname === "resumenestrials.com");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const { username, password, captchaToken } = await req.json();
    const cleanUsername = String(username || "").trim().toLowerCase();
    const cleanPassword = String(password || "");

    if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername) || cleanPassword.length < 1) {
      return json({ error: "Credenciales incorrectas" }, 400);
    }

    if (!(await validateTurnstile(String(captchaToken || ""), req))) {
      return json({ error: "Verificación de seguridad no válida" }, 403);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceRole || !anonKey) return json({ error: "Servicio no configurado" }, 500);

    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (!profile?.email) return json({ error: "Credenciales incorrectas" }, 400);

    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await authClient.auth.signInWithPassword({
      email: profile.email,
      password: cleanPassword,
    });

    if (error || !data.session) return json({ error: "Credenciales incorrectas" }, 400);

    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
    }, 200);
  } catch (error) {
    console.error("login-username", error);
    return json({ error: "No fue posible iniciar sesión" }, 500);
  }

  function json(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
