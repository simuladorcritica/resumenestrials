(() => {
  const FOOTER = 'resumenestrials.com · X: @resumenestrials · Telegram: @ResumenesTrials · Contacto: resumenestrials@outlook.com';
  const MAX_TRIES = 80;
  let tries = 0;

  function patchJsPDF() {
    const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!jsPDF?.API || typeof jsPDF.API.save !== 'function') return false;
    if (jsPDF.API.__rtContactFooterPatched) return true;

    const originalSave = jsPDF.API.save;
    jsPDF.API.save = function (...args) {
      try {
        if (!this.__rtContactFooterApplied) {
          const currentPage = this.internal.getCurrentPageInfo?.().pageNumber || 1;
          const total = this.getNumberOfPages();
          for (let page = 1; page <= total; page++) {
            this.setPage(page);
            const pageW = this.internal.pageSize.getWidth();
            const pageH = this.internal.pageSize.getHeight();
            this.setFont('helvetica', 'normal');
            this.setFontSize(6.4);
            this.setTextColor(105, 112, 120);
            this.text(FOOTER, pageW / 2, pageH - 15, { align: 'center' });
          }
          this.setPage(Math.min(currentPage, total));
          this.__rtContactFooterApplied = true;
        }
      } catch (error) {
        console.warn('No se pudo añadir el pie de contacto al PDF:', error);
      }
      return originalSave.apply(this, args);
    };

    jsPDF.API.__rtContactFooterPatched = true;
    return true;
  }

  if (patchJsPDF()) return;
  const timer = window.setInterval(() => {
    tries += 1;
    if (patchJsPDF() || tries >= MAX_TRIES) window.clearInterval(timer);
  }, 125);
})();
