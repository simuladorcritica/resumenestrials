(() => {
  const hoy = () => new Date().toISOString().slice(0, 10);
  const instalar = () => {
    if (typeof objeto !== 'function' || typeof existentes === 'undefined' || window.__rtEditorialDatesInstalled) return;
    const baseObjeto = objeto;
    objeto = function objetoConFechasEditoriales() {
      const o = baseObjeto();
      const previo = existentes.find((x) => String(x.id) === String(o.id));
      if (previo?.fecha_publicacion_resumen) o.fecha_publicacion_resumen = previo.fecha_publicacion_resumen;
      else if (!previo) o.fecha_publicacion_resumen = hoy();
      if (previo) o.fecha_revision = hoy();
      else if (!o.fecha_revision) o.fecha_revision = o.fecha_publicacion_resumen;
      return o;
    };
    window.__rtEditorialDatesInstalled = true;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalar, { once:true });
  else instalar();
})();
