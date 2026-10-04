// revisar_pagina_pdf.mjs — Resumenes Trials
// Abre la página como lo haría un lector y comprueba, para cada id:
//   1. que index.html y resumen.html?id=N cargan sin errores de JavaScript,
//   2. que el resumen se renderiza (título y contenido presentes),
//   3. que el botón "Descargar" genera de verdad un PDF no vacío (jsPDF).
//
// Requiere: node + playwright (chromium).
// Uso:  BASE_URL=http://localhost:8000 node revisar_pagina_pdf.mjs
// Sale con código 1 si detecta algún problema.

import { chromium } from "playwright";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const PDF_MIN_BYTES = 3000;         // un PDF real de un resumen pesa bastante más
const PDF_TIMEOUT = 20000;

const problemas = [];
const push = (id, msg) => problemas.push({ id, msg });
const recursosFaltantes = new Set();   // recursos 404, reportados una sola vez

// Errores de consola/JS que son ruido conocido y no queremos reportar.
const ruido = /favicon/i;
const esRecurso404 = /Failed to load resource/i;

async function cargarConVigilancia(page, url, etiqueta) {
  const errs = [];
  const onConsole = (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (ruido.test(t)) return;
    if (esRecurso404.test(t)) { recursosFaltantes.add(etiqueta + " :: " + t); return; }
    errs.push(t);
  };
  const onPageError = (e) => errs.push("excepción JS: " + String(e));
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  const onFailed = (r) => recursosFaltantes.add((r.url().split("/").pop() || r.url()));
  page.on("requestfailed", onFailed);
  const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch((e) => {
    errs.push("no cargó: " + e.message); return null;
  });
  if (resp && resp.status() >= 400) errs.push("HTTP " + resp.status());
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("requestfailed", onFailed);
  return errs;
}

async function main() {
  // Lista de ids desde el propio origen servido
  const ids = await fetch(`${BASE}/resumenes.json`).then(r => r.json())
    .then(d => d.map(e => e.id)).catch(() => null);
  if (!ids) { console.error("No pude leer resumenes.json desde", BASE); process.exit(2); }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    acceptDownloads: true,
    // Para pruebas locales detrás de un proxy que intercepta TLS: IGNORE_HTTPS=1
    ignoreHTTPSErrors: process.env.IGNORE_HTTPS === "1",
  });
  const page = await ctx.newPage();

  // 1) Portada
  let errs = await cargarConVigilancia(page, `${BASE}/index.html`, "index");
  errs.forEach(e => push("index", "JS/carga: " + e));
  const nCards = await page.locator("a[href*='resumen.html'], .card, article").count().catch(() => 0);
  if (!nCards) push("index", "la portada no muestra ningún resumen enlazado");

  // Precheck: ¿cargó la librería jsPDF desde el CDN? Si no, es un problema de
  // disponibilidad del CDN (afecta a TODOS los PDF), no un fallo por entrada.
  await page.goto(`${BASE}/resumen.html?id=${ids[0]}`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  const jspdfOk = await page.evaluate(() =>
    typeof window.jspdf !== "undefined" || typeof window.jsPDF !== "undefined").catch(() => false);
  if (!jspdfOk) {
    push("PDF", "la librería jsPDF no se cargó (¿CDN cdnjs caído o bloqueado?): fallarían todas las descargas");
  }

  // 2) Cada resumen + su PDF
  for (const id of ids) {
    const url = `${BASE}/resumen.html?id=${id}`;
    const e2 = await cargarConVigilancia(page, url, `id ${id}`);
    e2.forEach(e => push(id, "JS/carga: " + e));

    const cuerpo = (await page.locator("body").innerText().catch(() => "")) || "";
    if (cuerpo.length < 200) push(id, "el resumen se ve casi vacío en la página");
    if (/\bundefined\b|NaN|\[object Object\]/.test(cuerpo)) push(id, "aparece 'undefined'/'NaN' en el texto renderizado");

    // PDF: pulsar el primer botón de descarga y esperar el archivo
    // (si jsPDF no cargó, ya se reportó arriba; no repetimos el fallo por cada id)
    const boton = page.locator("button:has-text('Descargar'), a:has-text('Descargar')").first();
    if (jspdfOk && await boton.count()) {
      try {
        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: PDF_TIMEOUT }),
          boton.click(),
        ]);
        const dir = mkdtempSync(join(tmpdir(), "pdf-"));
        const ruta = join(dir, "salida.pdf");
        await download.saveAs(ruta);
        const bytes = statSync(ruta).size;
        if (bytes < PDF_MIN_BYTES) push(id, `el PDF generado es sospechosamente pequeño (${bytes} bytes)`);
      } catch (err) {
        push(id, "el botón no generó un PDF (jsPDF falló y cayó a window.print): " + err.message);
      }
    } else if (jspdfOk) {
      push(id, "no se encontró botón de descarga de PDF");
    }
  }

  await browser.close();

  for (const r of recursosFaltantes) push("recurso", "recurso no encontrado (404): " + r);

  console.log("=".repeat(60));
  console.log(`  Revisión de página y PDF — ${BASE}`);
  console.log(`  IDs revisados: ${ids.length}  |  Problemas: ${problemas.length}`);
  console.log("=".repeat(60));
  if (problemas.length === 0) {
    console.log("\nPágina y descargas de PDF sin problemas.");
    process.exit(0);
  }
  for (const p of problemas) console.log(`  [id ${p.id}] ${p.msg}`);
  process.exit(1);
}

main().catch(e => { console.error(e); process.exit(2); });
