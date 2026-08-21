(() => {
  const SELECTOR = '[data-trial-download],[data-rt-footer-download]';
  const buttons = () => [...document.querySelectorAll(SELECTOR)];
  if (!buttons().length) return;

  const SOCIAL = 'resumenestrials.com   |   X: @resumenestrials   |   Telegram: @ResumenesTrials';
  const EMAIL = 'Contacto: resumenestrials@outlook.com';
  let dataPromise = null;
  let jsPdfPromise = null;

  const text = (value) => {
    const node = document.createElement('div');
    node.innerHTML = String(value || '');
    return (node.textContent || '').replace(/\s+/g, ' ').trim();
  };

  const clean = (value) => String(value == null ? '' : value)
    .replace(/\u2212/g, '-')
    .replace(/[\u2013\u2014\u2015\u2012\u2011]/g, '-')
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u2007\u2009\u200A\u202F]/g, ' ')
    .replace(/\u2265/g, '>=').replace(/\u2264/g, '<=')
    .replace(/\u2192/g, '->').replace(/\u2190/g, '<-');

  function loadJsPDF() {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf);
    if (jsPdfPromise) return jsPdfPromise;
    jsPdfPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-rt-jspdf]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.jspdf), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.integrity = 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk';
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.dataset.rtJspdf = '1';
      script.onload = () => window.jspdf?.jsPDF ? resolve(window.jspdf) : reject(new Error('jsPDF no disponible'));
      script.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
      document.head.appendChild(script);
    });
    return jsPdfPromise;
  }

  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch('/resumenes.json', { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)));
    }
    return dataPromise;
  }

  function filename(record) {
    const base = (text(record.titulo).split(':')[0] || 'resumen').trim();
    const safe = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\-]+/g, '_').slice(0, 40) || 'resumen';
    return `Resumen_${safe}.pdf`;
  }

  function blocks(html) {
    const root = document.createElement('div');
    root.innerHTML = html || '';
    root.querySelectorAll('*').forEach((node) => {
      if (!['H2', 'P', 'STRONG', 'EM', 'UL', 'OL', 'LI'].includes(node.tagName)) node.replaceWith(document.createTextNode(node.textContent || ''));
      else [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
    });
    const out = [];
    root.childNodes.forEach((node) => {
      if (node.nodeType === 3 && node.textContent.trim()) out.push({ type: 'p', text: node.textContent.trim() });
      if (node.nodeType !== 1) return;
      if (node.tagName === 'H2') out.push({ type: 'h2', text: node.textContent.trim() });
      else if (node.tagName === 'P') out.push({ type: 'p', text: node.textContent.trim() });
      else if (node.tagName === 'UL' || node.tagName === 'OL') {
        node.querySelectorAll('li').forEach((li) => out.push({ type: 'li', text: li.textContent.trim() }));
      } else if (node.textContent.trim()) out.push({ type: 'p', text: node.textContent.trim() });
    });
    return out;
  }

  async function makePdf(record) {
    const ns = await loadJsPDF();
    const doc = new ns.jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 56;
    const width = pageW - margin * 2;
    const bottom = pageH - 78;
    let y = 58;

    const lines = (value, w = width) => doc.splitTextToSize(clean(value), w);
    const newPage = () => { doc.addPage(); y = 62; };
    const ensure = (height) => { if (y + height > bottom) newPage(); };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 95, 95);
    doc.text('RESÚMENES TRIALS', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('EVIDENCIA SIN RUIDO', pageW - margin, y, { align: 'right' });
    y += 9;
    doc.setDrawColor(15, 95, 95);
    doc.setLineWidth(1.6);
    doc.line(margin, y, pageW - margin, y);
    y += 27;

    doc.setFont('times', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(18, 35, 59);
    lines(text(record.titulo)).forEach((line) => { ensure(22); doc.text(line, margin, y); y += 22; });
    y += 7;

    const classification = [record.especialidad_principal, record.especialidad_secundaria, record.tipo_estudio]
      .filter(Boolean).filter((value, index, arr) => arr.indexOf(value) === index).join(' · ');
    if (classification) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 95, 95);
      lines(classification.toUpperCase()).forEach((line) => { ensure(12); doc.text(line, margin, y); y += 12; });
      y += 4;
    }

    const meta = [record.autor, record.anio ? `${record.revista} ${record.anio}` : record.revista, record.doi ? `DOI: ${record.doi}` : '']
      .filter(Boolean).join(' · ');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(56, 80, 110);
    lines(meta).forEach((line) => { ensure(13); doc.text(line, margin, y); y += 13; });
    y += 19;

    for (const block of blocks(record.cuerpo)) {
      if (block.type === 'h2') {
        y += 7;
        ensure(18);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 95, 95);
        lines(block.text.toUpperCase()).forEach((line) => { ensure(13); doc.text(line, margin, y); y += 13; });
        y += 5;
        continue;
      }
      doc.setFont('times', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(24, 30, 40);
      const prefix = block.type === 'li' ? '•  ' : '';
      lines(prefix + block.text).forEach((line) => { ensure(15); doc.text(line, margin, y); y += 15; });
      y += 7;
    }

    if (record.original) {
      y += 4;
      ensure(30);
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
    const sourceRef = `resumenestrials.com/resumen.html?id=${record.id}`;
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setDrawColor(224, 221, 213);
      doc.setLineWidth(.5);
      doc.line(margin, pageH - 54, pageW - margin, pageH - 54);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(110, 115, 120);
      doc.text(sourceRef, margin, pageH - 42);
      doc.text(`Página ${p} de ${total}`, pageW - margin, pageH - 42, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.4);
      doc.setTextColor(15, 95, 95);
      doc.text(SOCIAL, pageW / 2, pageH - 25, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.1);
      doc.setTextColor(70, 85, 100);
      doc.text(EMAIL, pageW / 2, pageH - 13, { align: 'center' });
    }
    doc.save(filename(record));
  }

  async function run(button) {
    const id = String(button.dataset.trialDownload || button.dataset.rtFooterDownload || '').trim();
    if (!id) return;
    const original = button.innerHTML;
    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = '<span>Generando PDF…</span>';
    try {
      const data = await loadData();
      const record = Array.isArray(data) ? data.find((item) => String(item.id) === id) : null;
      if (!record) throw new Error(`No se encontró el trial ${id}`);
      await makePdf(record);
    } catch (error) {
      console.error('Descarga PDF:', error);
      const fallback = `/resumen.html?id=${encodeURIComponent(id)}`;
      window.location.href = fallback;
    } finally {
      button.disabled = false;
      button.classList.remove('is-loading');
      button.innerHTML = original;
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest(SELECTOR);
    if (!button) return;
    event.preventDefault();
    run(button);
  });
})();
