const RUNTIME_SCRIPT_PATTERN = /<script\b[^>]*\bsrc=["'](\/site-runtime\.js(?:\?[^"']*)?)["'][^>]*>/i;
const OBSOLETE_READER_SCRIPT_PATTERN = /<script\b[^>]*\bsrc=["'][^"']*reader-controls-v9\.js(?:\?[^"']*)?["'][^>]*>/i;

const RUNTIME_MARKERS = Object.freeze({
  generatedBundle: '/* GENERATED FILE. Run: node scripts/build-site-runtime.mjs */',
  readerSource: '/* source: ui/reader.js */',
  readerGuard: 'data-ev-sections',
  minimumTouchHeight: "min-height:44px",
  touchAction: "touch-action:manipulation",
});

export function inspectReaderRuntime(html, runtimeJavaScript = '', runtimeCSS = '') {
  const source = String(html || '');
  const runtime = String(runtimeJavaScript || '');
  const styles=String(runtimeCSS||'');
  const runtimePath = source.match(RUNTIME_SCRIPT_PATTERN)?.[1]?.replaceAll('&amp;', '&') || null;
  const checks = {
    bundledRuntimeReference: Boolean(runtimePath),
    noObsoleteDirectReference: !OBSOLETE_READER_SCRIPT_PATTERN.test(source),
    generatedBundle: runtime.includes(RUNTIME_MARKERS.generatedBundle),
    readerSource: runtime.includes(RUNTIME_MARKERS.readerSource),
    readerGuard: runtime.includes(RUNTIME_MARKERS.readerGuard),
    minimumTouchHeight: styles.includes(RUNTIME_MARKERS.minimumTouchHeight),
    touchAction: styles.includes(RUNTIME_MARKERS.touchAction),
  };

  return {
    runtimePath,
    checks,
    ready: Object.values(checks).every(Boolean),
  };
}

export { RUNTIME_MARKERS };
