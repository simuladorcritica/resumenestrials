// Attribute only the provider exception demonstrated in the production CI log.
// Missing, native, mixed or application frames remain blocking errors.
export function isKnownAdsRuntimeError(error) {
  if (error?.message !== 'int64' || typeof error.stack !== 'string') return false;
  const frames = error.stack.split('\n').slice(1).map(line => line.trim()).filter(Boolean);
  if (!frames.length) return false;
  return frames.every(line => {
    if (!line.startsWith('at ')) return false;
    const matches = line.match(/https?:\/\/[^\s)]+/g);
    if (matches?.length !== 1) return false;
    try {
      const url = new URL(matches[0]);
      return url.protocol === 'https:' && url.hostname === 'pagead2.googlesyndication.com' && !url.port &&
        /^\/pagead\/js\/[^?#]*\/rum_fy2021\.js(?::\d+){2}$/.test(url.pathname);
    } catch { return false; }
  });
}
