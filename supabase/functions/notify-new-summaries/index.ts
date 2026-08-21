import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const REPOSITORY = "simuladorcritica/resumenestrials";
const SITE_URL = "https://resumenestrials.com";
const GITHUB_API = "https://api.github.com";
const RAW_GITHUB = "https://raw.githubusercontent.com";
const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
const FROM_EMAIL = Deno.env.get("NEWSLETTER_FROM") || "Resúmenes Trials <novedades@resumenestrials.com>";
const REPLY_TO = Deno.env.get("NEWSLETTER_REPLY_TO") || "resumenestrials@outlook.com";
const TEXT_ENCODER = new TextEncoder();

type Subscriber = { id: string; email: string; first_name: string | null };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function plainText(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function short(value: unknown, max = 240) {
  const text = plainText(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 120 ? space : max).trim()}…`;
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function unsubscribeKey(serviceRole: string) {
  return await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(serviceRole),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signSubscriberId(key: CryptoKey, id: string) {
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    TEXT_ENCODER.encode(`resumenestrials-newsletter-unsubscribe-v1:${id}`),
  );
  return toBase64Url(new Uint8Array(signature));
}

async function verifyUnsubscribeToken(key: CryptoKey, token: string) {
  const match = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/i.exec(token);
  if (!match) return null;
  const [, id, supplied] = match;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null;
  const expected = await signSubscriberId(key, id);
  return constantTimeEqual(expected, supplied) ? id : null;
}

async function githubJson(path: string, token: string) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "resumenestrials-newsletter/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GitHub ${response.status} en ${path}`);
  return await response.json();
}

async function validateInstallationToken(token: string) {
  if (!token) throw new Error("Falta el token efímero de GitHub Actions");
  const payload = await githubJson("/installation/repositories?per_page=100", token);
  const allowed = (payload?.repositories || []).some((repo: any) => repo?.full_name === REPOSITORY);
  if (!allowed) throw new Error("El token de GitHub no pertenece a la instalación autorizada para este repositorio");
}

async function validateRun(runId: number, runAttempt: number, beforeSha: string, headSha: string, token: string) {
  if (!Number.isInteger(runId) || runId <= 0) throw new Error("run_id inválido");
  if (!Number.isInteger(runAttempt) || runAttempt <= 0) throw new Error("run_attempt inválido");
  if (!/^[0-9a-f]{40}$/i.test(beforeSha) || /^0{40}$/.test(beforeSha)) throw new Error("before_sha inválido");
  if (!/^[0-9a-f]{40}$/i.test(headSha)) throw new Error("head_sha inválido");

  await validateInstallationToken(token);
  const run = await githubJson(`/repos/${REPOSITORY}/actions/runs/${runId}`, token);
  if (run?.repository?.full_name !== REPOSITORY) throw new Error("Repositorio no autorizado");
  if (run?.event !== "push" || run?.head_branch !== "main" || run?.head_sha !== headSha) {
    throw new Error("La ejecución no corresponde a un push válido de main");
  }
  if (Number(run?.run_attempt || 1) !== runAttempt) throw new Error("run_attempt no coincide con GitHub");

  const createdAt = Date.parse(String(run?.created_at || ""));
  if (runAttempt > 1 && (!Number.isFinite(createdAt) || Date.now() - createdAt > 23 * 60 * 60 * 1000)) {
    throw new Error("El reintento está fuera de la ventana segura de idempotencia");
  }

  const comparison = await githubJson(`/repos/${REPOSITORY}/compare/${beforeSha}...${headSha}`, token);
  if (comparison?.status !== "ahead") throw new Error("before_sha y head_sha no forman el push esperado");
}

async function rawJson(sha: string, path: string) {
  const response = await fetch(`${RAW_GITHUB}/${REPOSITORY}/${encodeURIComponent(sha)}/${path}`, {
    headers: { "User-Agent": "resumenestrials-newsletter/1.0" },
  });
  if (!response.ok) throw new Error(`No se pudo leer ${path} en ${sha}: HTTP ${response.status}`);
  return await response.json();
}

async function addedSummaries(beforeSha: string, headSha: string) {
  const [before, after] = await Promise.all([
    rawJson(beforeSha, "resumenes.json"),
    rawJson(headSha, "resumenes.json"),
  ]);
  const previousIds = new Set((Array.isArray(before) ? before : []).map((item: any) => String(item?.id)));
  return (Array.isArray(after) ? after : []).filter((item: any) => item?.id != null && !previousIds.has(String(item.id)));
}

async function confirmedOptInSubscribers(admin: any) {
  const confirmed = new Set<string>();
  for (let page = 1; page <= 1000; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users || [];
    for (const user of users) {
      if (user.email && user.email_confirmed_at) confirmed.add(user.id);
    }
    if (users.length < 1000) break;
  }

  const profiles: Subscriber[] = [];
  for (let from = 0; from < 100000; from += 1000) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,email,first_name")
      .eq("newsletter_opt_in", true)
      .not("email", "is", null)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    const rows = (data || []) as Subscriber[];
    profiles.push(...rows);
    if (rows.length < 1000) break;
  }

  const seen = new Set<string>();
  return profiles
    .filter((profile) => {
      const email = String(profile.email || "").trim().toLowerCase();
      if (!confirmed.has(profile.id) || !email || seen.has(email)) return false;
      seen.add(email);
      profile.email = email;
      return true;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function emailFor(
  subscriber: Subscriber,
  summaries: any[],
  key: CryptoKey,
  supabaseUrl: string,
) {
  const firstName = short(subscriber.first_name || "", 60);
  const hello = firstName ? `Hola, ${escapeHtml(firstName)}.` : "Hola.";
  const plural = summaries.length !== 1;
  const subject = plural
    ? `${summaries.length} nuevos resúmenes en Resúmenes Trials`
    : `Nuevo resumen: ${short(plainText(summaries[0]?.titulo).split(":")[0] || summaries[0]?.titulo, 90)}`;
  const signature = await signSubscriberId(key, subscriber.id);
  const unsubscribe = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/notify-new-summaries?unsubscribe=${encodeURIComponent(`${subscriber.id}.${signature}`)}`;

  const cards = summaries.map((summary) => {
    const title = plainText(summary?.titulo || "Nuevo resumen");
    const journal = plainText(summary?.revista || "");
    const year = plainText(summary?.anio || "");
    const author = plainText(summary?.autor || "");
    const finding = short(summary?.hallazgo || summary?.objetivo || "", 260);
    const url = `${SITE_URL}/resumen.html?id=${encodeURIComponent(String(summary.id))}`;
    const meta = [author, journal, year].filter(Boolean).join(" · ");
    return `
      <tr><td style="padding:0 0 18px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-top:1px solid #ddd8cc">
          <tr><td style="padding:18px 0 7px;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:1.25;color:#12233b;font-weight:600">${escapeHtml(title)}</td></tr>
          ${meta ? `<tr><td style="padding:0 0 8px;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#38506e">${escapeHtml(meta)}</td></tr>` : ""}
          ${finding ? `<tr><td style="padding:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:#263b55">${escapeHtml(finding)}</td></tr>` : ""}
          <tr><td><a href="${url}" style="display:inline-block;padding:10px 14px;background:#0f5f5f;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;font-weight:700;border-radius:3px">Leer resumen</a></td></tr>
        </table>
      </td></tr>`;
  }).join("");

  const htmlBody = `<!doctype html><html><body style="margin:0;background:#f7f6f2;color:#12233b">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f7f6f2"><tr><td align="center" style="padding:28px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;background:#ffffff;border:1px solid #e4dfd3">
        <tr><td style="padding:28px 34px 20px;border-bottom:2px solid #0f5f5f">
          <div style="font-family:Arial,sans-serif;font-size:13px;letter-spacing:.16em;font-weight:700;color:#0f5f5f">RESÚMENES TRIALS</div>
          <div style="margin-top:5px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:.08em;color:#6d7784">EVIDENCIA SIN RUIDO</div>
        </td></tr>
        <tr><td style="padding:30px 34px 10px">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:1.55;color:#12233b">${hello}</div>
          <div style="margin-top:10px;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.55;color:#263b55">${plural ? "Acabamos de publicar nuevos resúmenes que ya puedes consultar." : "Acabamos de publicar un nuevo resumen que ya puedes consultar."}</div>
        </td></tr>
        <tr><td style="padding:10px 34px 4px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${cards}</table></td></tr>
        <tr><td style="padding:22px 34px 30px;border-top:1px solid #ddd8cc;font-family:Arial,sans-serif;font-size:11px;line-height:1.65;color:#6d7784">
          Recibes este correo porque aceptaste avisos de nuevos resúmenes en Resúmenes Trials.<br>
          <a href="${unsubscribe}" style="color:#0f5f5f">Cancelar estos avisos</a> · <a href="${SITE_URL}/cuenta.html#notificaciones" style="color:#0f5f5f">Administrar notificaciones</a><br>
          <a href="${SITE_URL}" style="color:#0f5f5f">resumenestrials.com</a> · X: @resumenestrials · Telegram: @ResumenesTrials · resumenestrials@outlook.com
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const textItems = summaries.map((summary) => {
    const title = plainText(summary?.titulo || "Nuevo resumen");
    const meta = [plainText(summary?.autor), plainText(summary?.revista), plainText(summary?.anio)].filter(Boolean).join(" · ");
    const finding = short(summary?.hallazgo || summary?.objetivo || "", 260);
    const url = `${SITE_URL}/resumen.html?id=${encodeURIComponent(String(summary.id))}`;
    return `${title}\n${meta}${meta ? "\n" : ""}${finding}${finding ? "\n" : ""}${url}`;
  }).join("\n\n");
  const text = `${firstName ? `Hola, ${firstName}.` : "Hola."}\n\n${plural ? "Acabamos de publicar nuevos resúmenes." : "Acabamos de publicar un nuevo resumen."}\n\n${textItems}\n\nCancelar estos avisos: ${unsubscribe}\nAdministrar notificaciones: ${SITE_URL}/cuenta.html#notificaciones\n\nresumenestrials.com · X: @resumenestrials · Telegram: @ResumenesTrials · resumenestrials@outlook.com`;

  return {
    from: FROM_EMAIL,
    to: [subscriber.email],
    reply_to: REPLY_TO,
    subject,
    html: htmlBody,
    text,
    headers: {
      "List-Unsubscribe": `<${unsubscribe}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

async function sendBatches(
  resendKey: string,
  subscribers: Subscriber[],
  summaries: any[],
  headSha: string,
  serviceRole: string,
  supabaseUrl: string,
) {
  const key = await unsubscribeKey(serviceRole);
  const batches = chunk(subscribers, 100);
  let queued = 0;
  for (let index = 0; index < batches.length; index += 1) {
    const emails = await Promise.all(batches[index].map((subscriber) => emailFor(subscriber, summaries, key, supabaseUrl)));
    const response = await fetch(RESEND_BATCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `resumenestrials-${headSha}-${index}`,
      },
      body: JSON.stringify(emails),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Resend batch error", response.status, payload);
      throw new Error(`Resend rechazó el lote ${index + 1}: HTTP ${response.status}`);
    }
    queued += emails.length;
  }
  return { batches: batches.length, queued };
}

async function handleUnsubscribe(token: string, method: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return method === "POST" ? new Response("", { status: 503 }) : html("Servicio temporalmente no disponible.", 503);

  const key = await unsubscribeKey(serviceRole);
  const id = await verifyUnsubscribeToken(key, token);
  if (!id) return method === "POST" ? new Response("", { status: 400 }) : html("Enlace de cancelación no válido.", 400);

  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin
    .from("profiles")
    .update({ newsletter_opt_in: false, newsletter_opt_in_at: null })
    .eq("id", id);
  if (error) {
    console.error("unsubscribe", error);
    return method === "POST" ? new Response("", { status: 503 }) : html("No fue posible procesar la solicitud. Inténtalo de nuevo.", 503);
  }

  if (method === "POST") return new Response("", { status: 200, headers: { "Cache-Control": "no-store" } });
  return html(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Avisos desactivados · Resúmenes Trials</title></head><body style="margin:0;background:#f7f6f2;color:#12233b;font-family:Georgia,'Times New Roman',serif"><main style="max-width:640px;margin:8vh auto;padding:32px"><div style="font-family:Arial,sans-serif;font-size:13px;letter-spacing:.14em;font-weight:700;color:#0f5f5f">RESÚMENES TRIALS</div><h1 style="font-size:34px;font-weight:500">Avisos por correo desactivados</h1><p style="font-size:18px;line-height:1.6">No volverás a recibir avisos de nuevos resúmenes mientras esta preferencia permanezca desactivada.</p><p style="font-size:16px;line-height:1.6">Puedes volver a activarlos cuando quieras desde <a href="${SITE_URL}/cuenta.html#notificaciones" style="color:#0f5f5f">tu cuenta</a>.</p><p><a href="${SITE_URL}" style="color:#0f5f5f">Volver a Resúmenes Trials</a></p></main></body></html>`);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const unsubscribe = url.searchParams.get("unsubscribe");
  if (unsubscribe && (req.method === "GET" || req.method === "POST")) {
    return await handleUnsubscribe(unsubscribe, req.method);
  }

  if (req.method === "GET") return json({ ok: true, service: "notify-new-summaries" }, 200);
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const githubToken = req.headers.get("x-github-token") || "";
    const body = await req.json().catch(() => ({}));
    const runId = Number(body?.run_id);
    const runAttempt = Number(body?.run_attempt || 1);
    const beforeSha = String(body?.before_sha || "").trim();
    const headSha = String(body?.head_sha || "").trim();

    await validateRun(runId, runAttempt, beforeSha, headSha, githubToken);
    const summaries = await addedSummaries(beforeSha, headSha);
    if (!summaries.length) return json({ ok: true, skipped: true, reason: "No se agregaron nuevos IDs a resumenes.json." }, 200);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!supabaseUrl || !serviceRole) throw new Error("Faltan credenciales internas de Supabase");
    if (!resendKey) throw new Error("Falta RESEND_API_KEY en los secretos de la Edge Function");

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const subscribers = await confirmedOptInSubscribers(admin);
    if (!subscribers.length) {
      return json({ ok: true, summaries: summaries.map((item: any) => item.id), subscribers: 0, queued: 0 }, 200);
    }

    const result = await sendBatches(resendKey, subscribers, summaries, headSha, serviceRole, supabaseUrl);
    return json({
      ok: true,
      summaries: summaries.map((item: any) => item.id),
      subscribers: subscribers.length,
      queued: result.queued,
      batches: result.batches,
    }, 200);
  } catch (error) {
    console.error("notify-new-summaries", error);
    return json({ error: error instanceof Error ? error.message : "No fue posible enviar los avisos" }, 500);
  }
});
