import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://resumenestrials.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const { username, password, captchaToken } = await req.json();
    const cleanUsername = String(username || "").trim().toLowerCase();
    const cleanPassword = String(password || "");
    const cleanCaptcha = String(captchaToken || "").trim();

    if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername) || cleanPassword.length < 1) {
      return json({ error: "Credenciales incorrectas" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceRole || !anonKey) return json({ error: "Servicio no configurado" }, 500);

    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("email")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (profileError) {
      console.error("login-username profile", profileError.message);
      return json({ error: "Servicio de acceso no disponible" }, 500);
    }
    if (!profile?.email) return json({ error: "Credenciales incorrectas" }, 400);

    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const credentials: {
      email: string;
      password: string;
      options?: { captchaToken: string };
    } = {
      email: profile.email,
      password: cleanPassword,
    };
    if (cleanCaptcha) credentials.options = { captchaToken: cleanCaptcha };

    const { data, error } = await authClient.auth.signInWithPassword(credentials);

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
