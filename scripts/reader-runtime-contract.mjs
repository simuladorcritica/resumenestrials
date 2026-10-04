const RUNTIME_SCRIPT_PATTERN = /<script\b[^>]*\bsrc=["'](\/site-runtime\.js(?:\?[^"']*)?)["'][^>]*>/i;
const OBSOLETE_READER_SCRIPT_PATTERN = /<script\b[^>]*\bsrc=["'][^"']*reader-controls-v9\.js(?:\?[^"']*)?["'][^>]*>/i;

const RUNTIME_MARKERS = Object.freeze({
  generatedBundle: '/* GENERATED FILE. Run: node scripts/build-site-runtime.mjs */',
  readerSource: '/* source: reader-controls-v9.js */',
  readerGuard: '__rtReaderControlsV9',
  minimumTouchHeight: "setProperty('min-height', '54px'",
  touchAction: "setProperty('touch-action', 'manipulation'",
});

export function inspectReaderRuntime(html, runtimeJavaScript = '') {
  const source = String(html || '');
  const runtime = String(runtimeJavaScript || '');
  const runtimePath = source.match(RUNTIME_SCRIPT_PATTERN)?.[1]?.replaceAll('&amp;', '&') || null;
  const checks = {
    bundledRuntimeReference: Boolean(runtimePath),
    noObsoleteDirectReference: !OBSOLETE_READER_SCRIPT_PATTERN.test(source),
    generatedBundle: runtime.includes(RUNTIME_MARKERS.generatedBundle),
    readerSource: runtime.includes(RUNTIME_MARKERS.readerSource),
    readerGuard: runtime.includes(RUNTIME_MARKERS.readerGuard),
    minimumTouchHeight: runtime.includes(RUNTIME_MARKERS.minimumTouchHeight),
    touchAction: runtime.includes(RUNTIME_MARKERS.touchAction),
  };

  return {
    runtimePath,
    checks,
    ready: Object.values(checks).every(Boolean),
  };
}

export { RUNTIME_MARKERS };
