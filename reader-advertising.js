// Called only after the reader has resolved and rendered its selected record.
// No side effects on import: loading/error states never contact advertising.
export function loadReaderAdvertising(article, content) {
  const requested = new URLSearchParams(location.search).get('id');
  if (location.pathname !== '/resumen.html' || !requested || !article
      || String(article.id) !== requested || !content?.isConnected
      || !content.textContent.trim()) return false;
  if (document.querySelector('script[src*="/pagead/js/adsbygoogle.js"]')) return true;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3132744538918477';
  document.head.append(script);
  return true;
}
