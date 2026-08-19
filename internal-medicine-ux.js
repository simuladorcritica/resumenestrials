const MI = 'Medicina Interna';

const CURRENT_SUBSPECIALTIES = new Map([
  ['10.1056/NEJMoa2601005', 'Cardiología'],
  ['10.1056/NEJMoa2515043', 'Cardiología'],
  ['10.1056/NEJMoa2516567', 'Neumología'],
  ['10.1056/NEJMoa2514428', 'Cardiología'],
  ['10.1056/NEJMoa2514120', 'Neurología'],
  ['10.1056/NEJMoa2512918', 'Cardiología'],
  ['10.1056/NEJMoa2510703', 'Hematología'],
  ['10.1056/NEJMoa2513310', 'Cardiología'],
  ['10.1056/NEJMoa2517213', 'Cardiología'],
  ['10.1056/NEJMoa2600283', 'Cardiología'],
  ['10.1056/NEJMoa2506905', 'Infectología'],
  ['10.1056/NEJMoa2502457', 'Infectología']
]);

let data = [];
let byId = new Map();
let enhancing = false;

const normalize = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

function belongsToInternalMedicine(record) {
  return record?.especialidad_principal === MI || record?.especialidad_secundaria === MI;
}

function inferSubspecialty(record) {
  if (!belongsToInternalMedicine(record)) return '';
  const doi = String(record.doi || '').trim();
  if (CURRENT_SUBSPECIALTIES.has(doi)) return CURRENT_SUBSPECIALTIES.get(doi);

  const topics = normalize(Array.isArray(record.temas) ? record.temas.join(' ') : '');
  if (/(reumat|artritis|lupus|vasculitis|espondilo)/.test(topics)) return 'Reumatología';
  if (/(covid|infeccion|bacteriem|antibiot|antimicrob|tuberculosis|vih)/.test(topics)) return 'Infectología';
  if (/(ictus|trombectom|neurolog|cerebrovascular|esclerosis|epilep)/.test(topics)) return 'Neurología';
  if (/(embolia pulmonar|neumolog|asma|epoc|intersticial)/.test(topics)) return 'Neumología';
  if (/(anticoagul|tromboemb|hematolog|anemia|plaquet|linfom|leucem)/.test(topics)) return 'Hematología';
  if (/(renal|nefro|dialisis|glomerul|albuminuria)/.test(topics)) return 'Nefrología';
  if (/(diabetes|endocr|tiroid|obesidad|metabol)/.test(topics)) return 'Endocrinología';
  if (/(hepat|cirrosis|gastro|intestinal|pancrea)/.test(topics)) return 'Gastroenterología';
  if (/(cardiolog|fibrilacion|infarto|lipid|hipertension|cardiovascular|coronari)/.test(topics)) return 'Cardiología';
  return 'Medicina Interna General';
}

function injectStyles() {
  if (document.getElementById('rt-mi-ux-style')) return;
  const style = document.createElement('style');
  style.id = 'rt-mi-ux-style';
  style.textContent = `
    .badge.subesp-mi{
      color:var(--tinta);border-color:rgba(200,137,42,.38);
      background:rgba(200,137,42,.08);text-transform:none;
      letter-spacing:.035em;font-weight:500
    }
    .fila-pdf{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center}
    .rt-download-brief{
      display:inline-flex;align-items:center;gap:7px;
      font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:500;
      letter-spacing:.045em;color:#8a5a22;background:transparent;
      border:1px solid rgba(200,137,42,.45);padding:8px 14px;
      border-radius:3px;cursor:pointer;min-height:38px;
      transition:background .2s ease,color .2s ease,border-color .2s ease
    }
    .rt-download-brief:hover{background:rgba(200,137,42,.09);color:var(--tinta);border-color:var(--ambar)}
    .rt-download-brief:disabled{opacity:.55;cursor:progress}
    .fila-pdf .btn-pdf{border-radius:3px;font-size:12px;font-weight:500;padding:8px 14px;min-height:38px}
    @media(max-width:620px){
      .fila-pdf{align-items:stretch}
      .fila-pdf .btn-pdf,.rt-download-brief{flex:1 1 190px;justify-content:center}
    }
  `;
  document.head.appendChild(style);
}

function rowId(row) {
  const link = row.querySelector('a.cabeza[href*="resumen.html?id="]');
  if (!link) return '';
  try { return new URL(link.href, location.href).searchParams.get('id') || ''; }
  catch { return ''; }
}

function addSubspecialtyBadge(row, record) {
  if (!belongsToInternalMedicine(record)) return;
  const labels = row.querySelector('.etiquetas');
  if (!labels || labels.querySelector('.subesp-mi')) return;
  const subspecialty = inferSubspecialty(record);
  if (!subspecialty) return;
  const badge = document.createElement('span');
  badge.className = 'badge subesp-mi';
  badge.textContent = subspecialty;
  badge.title = 'Subespecialidad de Medicina Interna';
  labels.appendChild(badge);
}

function prepareDownloads(row, record) {
  const area = row.querySelector('.fila-pdf');
  if (!area) return;
  const full = area.querySelector('.btn-pdf');
  if (full && full.dataset.rtFullLabel !== '1') {
    full.dataset.rtFullLabel = '1';
    full.textContent = '⬇ Resumen completo';
    full.setAttribute('aria-label', 'Descargar el resumen completo en PDF');
  }

  if (!record.corto || area.querySelector('.rt-download-brief')) return;
  const brief = document.createElement('button');
  brief.type = 'button';
  brief.className = 'rt-download-brief';
  brief.dataset.id = String(record.id);
  brief.textContent = '⬇ Versión breve';
  brief.setAttribute('aria-label', 'Descargar la versión breve en PDF');
  brief.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await downloadBriefPDF(record, brief);
  });
  area.appendChild(brief);
}

function enhanceRows() {
  if (enhancing) return;
  enhancing = true;
  try {
    document.querySelectorAll('.fila').forEach((row) => {
      const record = byId.get(String(rowId(row)));
      if (!record) return;
      addSubspecialtyBadge(row, record);
      prepareDownloads(row, record);
    });
  } finally {
    enhancing = false;
  }
}

function plainText(html) {
  const node = document.createElement('div');
  node.innerHTML = html || '';
  return (node.textContent || '').replace(/\s+/g, ' ').trim();
}

function safeFilename(record) {
  const base = (plainText(record.titulo).split(':')[0] || 'resumen').trim();
  const safe = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\-]+/g, '_').slice(0, 40) || 'resumen';
  return `Resumen_${safe}_breve.pdf`;
}

function cleanPDFText(value) {
  return String(value == null ? '' : value)
    .replace(/\u2212/g, '-')
    .replace(/[\u2013\u2014\u2015\u2012\u2011]/g, '-')
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u2007\u2009\u200A\u202F]/g, ' ')
    .replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->').replace(/\u2190/g, '<-');
}

function briefBlocks(html) {
  const root = document.createElement('div');
  root.innerHTML = html || '';
  return [...root.childNodes].flatMap((node) => {
    if (node.nodeType === 3 && node.textContent.trim()) return [{ type: 'p', text: node.textContent.trim() }];
    if (node.nodeType !== 1) return [];
    if (node.tagName === 'H2') return [{ type: 'h2', text: node.textContent.trim() }];
    if (node.tagName === 'P') return [{ type: 'p', text: node.textContent.trim() }];
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      return [...node.querySelectorAll('li')].map((li) => ({ type: 'li', text: li.textContent.trim() }));
    }
    return node.textContent.trim() ? [{ type: 'p', text: node.textContent.trim() }] : [];
  });
}

async function generateBriefPDF(record) {
  const ns = window.jspdf;
  if (!ns?.jsPDF) {
    window.open(`resumen.html?id=${record.id}&v=corto`, '_blank', 'noopener');
    return;
  }

  const doc = new ns.jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  const width = pageW - margin * 2;
  const bottom = pageH - 62;
  let y = 58;

  const newPage = () => {
    doc.addPage();
    y = 58;
    doc.setDrawColor(224, 221, 213);
    doc.line(margin, 44, pageW - margin, 44);
  };
  const ensure = (height) => { if (y + height > bottom) newPage(); };
  const lines = (text, w = width) => doc.splitTextToSize(cleanPDFText(text), w);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 95, 95);
  doc.text('RESÚMENES TRIALS', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(138, 90, 34);
  doc.text('VERSIÓN BREVE', pageW - margin, y, { align: 'right' });
  y += 9;
  doc.setDrawColor(15, 95, 95);
  doc.setLineWidth(1.5);
  doc.line(margin, y, pageW - margin, y);
  y += 27;

  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(18, 35, 59);
  lines(plainText(record.titulo)).forEach((line) => { ensure(22); doc.text(line, margin, y); y += 22; });
  y += 7;

  const subspecialty = inferSubspecialty(record);
  const classification = [record.especialidad_principal, record.especialidad_secundaria, subspecialty]
    .filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).join(' · ');
  if (classification) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 95, 95);
    lines(classification.toUpperCase()).forEach((line) => { ensure(12); doc.text(line, margin, y); y += 12; });
    y += 4;
  }

  const meta = [record.autor, record.revista, record.fecha, record.doi ? `DOI: ${record.doi}` : ''].filter(Boolean).join(' · ');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(56, 80, 110);
  lines(meta).forEach((line) => { ensure(13); doc.text(line, margin, y); y += 13; });
  y += 19;

  briefBlocks(record.corto).forEach((block) => {
    if (block.type === 'h2') {
      y += 7;
      ensure(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 95, 95);
      lines(block.text.toUpperCase()).forEach((line) => { ensure(13); doc.text(line, margin, y); y += 13; });
      y += 5;
      return;
    }

    doc.setFont('times', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(24, 30, 40);
    const prefix = block.type === 'li' ? '•  ' : '';
    lines(prefix + block.text).forEach((line) => { ensure(15); doc.text(line, margin, y); y += 15; });
    y += 7;
  });

  if (record.original) {
    y += 4;
    ensure(28);
    doc.setDrawColor(221, 216, 204);
    doc.line(margin, y, pageW - margin, y);
    y += 13;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 95, 95);
    doc.text('ARTÍCULO ORIGINAL', margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(56, 80, 110);
    lines(record.original).forEach((line) => { ensure(12); doc.text(line, margin, y); y += 12; });
  }

  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page);
    doc.setDrawColor(224, 221, 213);
    doc.line(margin, pageH - 44, pageW - margin, pageH - 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`resumenestrials.com/resumen.html?id=${record.id}&v=corto`, margin, pageH - 31);
    doc.text(`Página ${page} de ${total}`, pageW - margin, pageH - 31, { align: 'right' });
  }

  doc.save(safeFilename(record));
}

async function downloadBriefPDF(record, button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Generando…';
  try { await generateBriefPDF(record); }
  catch (error) {
    console.error('PDF breve:', error);
    window.open(`resumen.html?id=${record.id}&v=corto`, '_blank', 'noopener');
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function init() {
  injectStyles();
  try {
    const response = await fetch('resumenes.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    byId = new Map(data.map((record) => [String(record.id), record]));
    enhanceRows();
    const index = document.getElementById('indice');
    if (index) new MutationObserver(enhanceRows).observe(index, { childList: true, subtree: true });
  } catch (error) {
    console.error('No se pudo inicializar la taxonomía de Medicina Interna:', error);
  }
}

init();
