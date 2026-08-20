import { createClient } from "npm:@supabase/supabase-js@2";

const REPOSITORY = "simuladorcritica/resumenestrials";
const SITE_URL = "https://resumenestrials.com";
const GITHUB_API = "https://api.github.com";
const RAW_GITHUB = "https://raw.githubusercontent.com";
const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";
const FROM_EMAIL = Deno.env.get("NEWSLETTER_FROM") || "Resúmenes Trials <novedades@resumenestrials.com>";
const REPLY_TO = Deno.env.get("NEWSLETTER_REPLY_TO") || "resumenestrials@outlook.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
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

async function githubJson(path: string) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "resumenestrials-newsletter/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GitHub ${response.status} en ${path}`);
  return await response.json();
}

async function rawJson(sha: string, path: string) {
  const response = await fetch(`${RAW_GITHUB}/${REPOSITORY}/${encodeURIComponent(sha)}/${path}`, {
    headers: { "User-Agent": "resumenestrials-newsletter/1.0" },
  });
  if (!response.ok) throw new Error(`No se pudo leer ${path} en ${sha}: HTTP ${response.status}`);
  return await response.json();
}

async function validateRun(runId: number, headSha: string, runAttempt: number) {
  if (!Number.isInteger(runId) || runId <= 0) throw new Error("run_id inválido");
  if (!/^[0-9a-f]{40}$/i.test(headSha)) throw new Error("head_sha inválido");
  if (runAttempt !== 1) return { skip: true, reason: "Los reintentos no reenvían correos." };

  const run = await githubJson(`/repos/${REPOSITORY}/actions/runs/${runId}`);
  if (run?.repository?.full_name !== REPOSITORY) throw new Error("Repositorio no autorizado");
  if (run?.event !== "push" || run?.head_branch !== "main" || run?.head_sha !== headSha) {
    throw new Error("La ejecución no corresponde a un push válido de main");
  }
  if (Number(run?.run_attempt || 1) !== 1) return { skip: true, reason: "Ejecución repetida." };

  const createdAt = Date.parse(String(run?.created_at || ""));
  if (!Number.isFinite(createdAt) || Math.abs(Date.now() - createdAt) > 20 * 60 * 1000) {
    throw new Error("La ejecución de GitHub ya no está dentro de la ventana autorizada");
  }
  return { skip: false, reason: "" };
}

async function addedSummaries(headSha: string) {
  const commit = await githubJson(`/repos/${REPOSITORY}/commits/${headSha}`);
  const parentSha = commit?.parents?.[0]?.sha;
  if (!parentSha) return [];

  const [before, after] = await Promise.all([
    rawJson(parentSha, "resumenes.json"),
    rawJson(headSha, "resumenes.json"),
  ]);
  const previousIds = new Set((Array.isArray(before) ? before : []).map((item: any) => String(item?.id)));
  return (Array.isArray(after) ? after : []).filter((item: any) => item?.id != null && !previousIds.has(String(item.id)));
}

async function confirmedOptInSubscribers(admin: ReturnType<typeof createClient>) {
  const confirmed = new Set<string>();
  for (let page = 1; page <= 1000; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users || [];
    for (const user of users) {
      if (user.email && (user.email_confirmed_at || user.confirmed_at)) confirmed.add(user.id);
    }
    if (users.length < 1000) break;
  }

  const profiles: Array<{ id: string; email: string; first_name: string | null }> = [];
  for (let from = 0; from < 100000; from += 1000) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,email,first_name")
      .eq("newsletter_opt_in", true)
      .not("email", "is", null)
      .range(from, from + 999);
    if (error) throw error;
    const rows = data || [];
    profiles.push(...rows);
    if (rows.length < 1000) break;
  }

  const seen = new Set<string>();
  return profiles.filter((profile) => {
    const email = String(profile.email || "").trim().toLowerCase();
    if (!confirmed.has(profile.id) || !email || seen.has(email)) return false;
    seen.add(email);
    profile.email = email;
    return true;
  });
}

function emailFor(subscriber: { email: string; first_name: string | null }, summaries: any[]) {
  const firstName = short(subscriber.first_name || "", 60);
  const hello = firstName ? `Hola, ${escapeHtml(firstName)}.` : "Hola.";
  const plural = summaries.length !== 1;
  const subject = plural
    ? `${summaries.length} nuevos resúmenes en Resúmenes Trials`
    : `Nuevo resumen: ${short(plainText(summaries[0]?.titulo).split(":")[0] || summaries[0]?.titulo, 90)}`;

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

  const html = `<!doctype html><html><body style="margin:0;background:#f7f6f2;color:#12233b">
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
        <tr><td style="padding:22px 34px 30px;border-top:1px solid #ddd8cc;font-family:Arial,sans-serif;font-size:11px;line-height:1.6;color:#6d7784">
          Recibes este correo porque aceptaste avisos de nuevos resúmenes en Resúmenes Trials. Puedes desactivarlos en <a href="${SITE_URL}/cuenta.html" style="color:#0f5f5f">tu cuenta</a> en cualquier momento.<br>
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
  const text = `${firstName ? `Hola, ${firstName}.` : "Hola."}\n\n${plural ? "Acabamos de publicar nuevos resúmenes." : "Acabamos de publicar un nuevo resumen."}\n\n${textItems}\n\nRecibes este correo porque aceptaste avisos de nuevos resúmenes en Resúmenes Trials. Puedes desactivarlos en ${SITE_URL}/cuenta.html\n\nresumenestrials.com · X: @resumenestrials · Telegram: @ResumenesTrials · resumenestrials@outlook.com`;

  return {
    from: FROM_EMAIL,
    to: [subscriber.email],
    reply_to: REPLY_TO,
    subject,
    html,
    text,
  };
}

async function sendBatches(resendKey: string, subscribers: any[], summaries: any[], headSha: string) {
  const batches = chunk(subscribers, 100);
  let queued = 0;
  for (let index = 0; index < batches.length; index += 1) {
    const emails = batches[index].map((subscriber) => emailFor(subscriber, summaries));
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const runId = Number(body?.run_id);
    const runAttempt = Number(body?.run_attempt || 1);
    const headSha = String(body?.head_sha || "").trim();

    const validation = await validateRun(runId, headSha, runAttempt);
    if (validation.skip) return json({ ok: true, skipped: true, reason: validation.reason }, 200);

    const summaries = await addedSummaries(headSha);
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

    const result = await sendBatches(resendKey, subscribers, summaries, headSha);
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
