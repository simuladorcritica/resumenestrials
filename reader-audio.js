// Audio del resumen completo («Escuchar»).
// Se carga solo en la versión completa de un resumen. Pregunta al almacén de audios si ese resumen tiene audio
// vigente (su ficha existe solo en ese caso) y, si lo tiene, muestra:
//   · un botón «Escuchar el resumen · N min» al principio, bajo el título y la firma (en cualquier pantalla);
//   · el mismo acceso en la barra de controles cuando hay sitio (pantallas anchas);
//   · al pulsarlo, el audio empieza y el reproductor queda a la vista mientras se lee: en la barra de controles,
//     que en el teléfono está fija abajo.
// Sin ficha, sin red o con una ficha que no reconoce, no muestra nada. El audio no se descarga hasta pulsar.
const BASE = 'https://audio.resumenestrials.com/';
const VERSION = '20261116';
const RATES = [1, 1.25, 1.5, 1.75, 2, 0.75];
const STEP = 15;
const svg = body => '<svg class="ev-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
const ICON = {
  listen: svg('<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.6"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.6"/>'),
  play: svg('<path d="M8.5 5.5v13l10-6.5z" fill="currentColor"/>'),
  pause: svg('<path d="M8.5 5.5v13M15.5 5.5v13"/>'),
  back: svg('<path d="M4 4.5v5h5"/><path d="M4.4 9.5A8 8 0 1 1 4 13"/>'),
  forward: svg('<path d="M20 4.5v5h-5"/><path d="M19.6 9.5A8 8 0 1 0 20 13"/>'),
  close: svg('<path d="m6 6 12 12M18 6 6 18"/>'),
};

export const clock = seconds => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
const spoken = seconds => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0)), m = Math.floor(s / 60), r = s % 60;
  return (m ? m + (m === 1 ? ' minuto' : ' minutos') + ' ' : '') + r + (r === 1 ? ' segundo' : ' segundos');
};
// La ficha es dato externo: solo se acepta la forma exacta que publica el generador (tools/voz.py).
// `version` es la huella del audio (el nombre del archivo): cambia cada vez que el resumen se corrige y se vuelve a generar.
export const audioFile = card => (card && typeof card.audio === 'string' && /^resumenes\/\d+\/[0-9a-f]{8,64}\.mp3$/.test(card.audio)
  && Number.isFinite(card.segundos) && card.segundos > 0 ? { url: BASE + card.audio, seconds: card.segundos, version: card.audio.slice(card.audio.lastIndexOf('/') + 1, -4) } : null);
const memory = {
  get(key) { try { return localStorage.getItem(key) } catch { return null } },
  set(key, value) { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, String(value)) } catch { /* sin almacenamiento: no pasa nada */ } },
  // Borra lo recordado de un resumen (`base` y `base:…`) salvo la clave vigente.
  prune(base, keep) { try { for (let i = localStorage.length - 1; i >= 0; i--) { const key = localStorage.key(i); if (key !== keep && (key === base || key.startsWith(base + ':'))) localStorage.removeItem(key) } } catch { /* sin almacenamiento */ } },
};
const styles = () => new Promise(done => {
  if (document.querySelector('link[data-ev-audio-css]')) return done();
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/reader-audio.css?v=' + VERSION; link.dataset.evAudioCss = '';
  link.onload = link.onerror = () => done();
  document.head.append(link);
});

export async function loadReaderAudio(reader, record) {
  const toolbar = reader?.querySelector('.ev-toolbar');
  if (!toolbar || !record || reader.dataset.evBrief === 'true' || toolbar.querySelector('[data-ev-listen]')) return false;
  const id = String(record.id);
  if (!/^\d+$/.test(id)) return false;
  let file = null;
  try {
    // keepalive: si el lector se va antes de que llegue la respuesta, la consulta termina en segundo plano en vez de
    // cancelarse (Safari anota como error en la consola toda consulta a otro dominio que se cancela al salir).
    const response = await fetch(BASE + 'resumenes/' + id + '.json', { cache: 'no-store', keepalive: true });
    if (response.ok) file = audioFile(await response.json());
  } catch { /* sin red o sin permiso: el resumen se lee igual */ }
  // La página reserva un sitio para el botón (así el texto no salta al aparecer) y otro en la barra de controles (así
  // sus botones no se desplazan); sin audio, los dos se retiran.
  let slot = reader.querySelector('[data-ev-listen-slot]');
  const gap = toolbar.querySelector('[data-ev-listen-gap]');
  if (!file) { slot?.remove(); gap?.remove(); reader.dataset.evAudio = 'none'; return false }
  await styles();

  const audio = new Audio();
  audio.preload = 'none';
  // Por dónde iba el lector se recuerda por versión del audio: si el resumen se corrige, el audio nuevo no es el mismo
  // (ni dura lo mismo) y empieza desde el principio. Lo recordado de versiones anteriores se borra.
  const posKey = 'ev-audio-pos:' + id + ':' + file.version, rateKey = 'ev-audio-rate';
  memory.prune('ev-audio-pos:' + id, posKey);
  let total = file.seconds, rate = RATES.includes(Number(memory.get(rateKey))) ? Number(memory.get(rateKey)) : 1;
  let pending = Math.min(Math.max(Number(memory.get(posKey)) || 0, 0), Math.max(total - 10, 0)), loaded = false, dragging = false, saved = 0;

  const minutes = Math.max(1, Math.round(total / 60));
  const entry = document.createElement('button');
  entry.type = 'button'; entry.className = 'ev-btn ev-listen'; entry.dataset.evListen = 'entrada';
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'ev-tool ev-listen-tool'; button.dataset.evListen = 'barra';
  for (const b of [entry, button]) b.setAttribute('aria-controls', 'ev-audio');
  const panel = document.createElement('div');
  panel.className = 'ev-audio'; panel.id = 'ev-audio'; panel.hidden = true;
  panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'Audio del resumen');
  panel.innerHTML = '<button type="button" class="ev-audio-play" data-ev-audio-play aria-label="Reproducir">' + ICON.play + '</button>'
    + '<button type="button" class="ev-tool ev-audio-skip" data-ev-audio-back aria-label="Retroceder ' + STEP + ' segundos">' + ICON.back + '<span>' + STEP + '</span></button>'
    + '<button type="button" class="ev-tool ev-audio-skip" data-ev-audio-forward aria-label="Avanzar ' + STEP + ' segundos"><span>' + STEP + '</span>' + ICON.forward + '</button>'
    + '<span class="ev-audio-time" data-ev-audio-now></span>'
    + '<input type="range" class="ev-audio-bar" data-ev-audio-bar min="0" step="1" aria-label="Posición del audio">'
    + '<span class="ev-audio-time" data-ev-audio-total></span>'
    + '<button type="button" class="ev-tool ev-audio-rate" data-ev-audio-rate></button>'
    + '<button type="button" class="ev-tool ev-audio-close" data-ev-audio-close aria-label="Cerrar el audio">' + ICON.close + '</button>';
  const part = name => panel.querySelector('[data-ev-audio-' + name + ']');
  const play = part('play'), bar = part('bar'), now = part('now'), whole = part('total'), speed = part('rate');
  const written = new Map();
  const write = (node, markup) => { if (written.get(node) !== markup) { written.set(node, markup); node.innerHTML = markup } };
  const notice = text => { const status = document.getElementById('ev-reader-status'); if (status) status.textContent = text };
  const position = () => (loaded ? audio.currentTime : pending);
  const paint = () => {
    const at = Math.min(position(), total);
    bar.max = String(Math.round(total));
    if (!dragging) bar.value = String(Math.round(at));
    bar.setAttribute('aria-valuetext', spoken(dragging ? bar.value : at) + ' de ' + spoken(total));
    now.textContent = clock(dragging ? bar.value : at); whole.textContent = clock(total);
    const playing = !audio.paused && !audio.ended;
    play.innerHTML = playing ? ICON.pause : ICON.play; play.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
    speed.textContent = String(rate).replace('.', ',') + '×'; speed.setAttribute('aria-label', 'Velocidad de reproducción: ' + String(rate).replace('.', ',') + '. Cambiar');
    panel.dataset.evAudioState = playing ? 'playing' : 'paused';
    // Los dos accesos dicen siempre qué va a pasar al pulsarlos.
    const started = at > 5, open = !panel.hidden;
    write(entry, (playing ? ICON.pause : ICON.listen) + '<span>' + (playing ? 'Pausar el audio' : open || started ? 'Continuar el audio' : 'Escuchar el resumen') + '</span>'
      + '<small>' + (playing || open || started ? clock(at) + ' de ' + clock(total) : minutes + ' min') + '</small>');
    write(button, (playing ? ICON.pause : ICON.listen) + '<span>' + (playing ? 'Pausar' : 'Escuchar') + '</span>');
    for (const b of [entry, button]) b.setAttribute('aria-pressed', String(playing));
  };
  const remember = force => {
    const at = position();
    if (!force && Math.abs(at - saved) < 5) return;
    saved = at; memory.set(posKey, at > 5 && at < total - 10 ? Math.floor(at) : null);
  };
  const seek = to => {
    const target = Math.min(Math.max(to, 0), Math.max(total - 1, 0));
    if (loaded) audio.currentTime = target; else pending = target;
    paint(); remember(true);
  };
  const start = async () => {
    if (!audio.src) { audio.src = file.url; audio.playbackRate = rate }
    try { await audio.play() } catch (error) { if (error?.name !== 'AbortError') notice('No se pudo reproducir el audio. Inténtalo de nuevo.') }
    paint();
  };
  const show = on => {
    panel.hidden = !on; toolbar.classList.toggle('ev-audio-open', on); document.documentElement.classList.toggle('ev-audio-on', on);
    document.documentElement.style.setProperty('--ev-audio-h', on ? panel.offsetHeight + 'px' : '0px');
    if (!on) { audio.pause(); remember(true) }
    paint();
  };
  // Un solo toque: «Escuchar» abre el reproductor y empieza; si ya suena, pausa.
  const toggle = () => { if (!audio.paused && !audio.ended) return audio.pause(); show(true); return start() };

  audio.addEventListener('loadedmetadata', () => {
    loaded = true;
    if (Number.isFinite(audio.duration) && audio.duration > 0) total = audio.duration;
    if (pending > 0) audio.currentTime = Math.min(pending, Math.max(total - 1, 0));
    audio.playbackRate = rate; paint();
  });
  audio.addEventListener('timeupdate', () => { paint(); remember(false) });
  for (const type of ['play', 'pause', 'ratechange']) audio.addEventListener(type, paint);
  audio.addEventListener('ended', () => { pending = 0; audio.currentTime = 0; memory.set(posKey, null); saved = 0; paint() });
  audio.addEventListener('error', () => { if (!audio.src) return; loaded = false; audio.removeAttribute('src'); notice('No se pudo cargar el audio. Inténtalo de nuevo.'); paint() });
  entry.onclick = button.onclick = play.onclick = toggle;
  part('back').onclick = () => seek(position() - STEP);
  part('forward').onclick = () => seek(position() + STEP);
  part('close').onclick = () => { const inside = panel.contains(document.activeElement); show(false); if (inside) (button.offsetParent ? button : entry).focus({ preventScroll: true }) };
  speed.onclick = () => { rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length]; audio.playbackRate = rate; memory.set(rateKey, rate); paint() };
  bar.addEventListener('input', () => { dragging = true; paint() });
  bar.addEventListener('change', () => { dragging = false; seek(Number(bar.value)) });
  addEventListener('pagehide', () => remember(true));
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: String(record.titulo || 'Resumen'), artist: 'Resúmenes Trials', album: String(record.revista || '') });
      navigator.mediaSession.setActionHandler('play', start);
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => seek(position() - STEP));
      navigator.mediaSession.setActionHandler('seekforward', () => seek(position() + STEP));
    } catch { /* el navegador no admite alguna acción */ }
  }

  // A la vista nada más abrir el resumen: justo bajo el título y la firma.
  if (!slot) { slot = document.createElement('div'); slot.className = 'ev-listen-slot'; slot.dataset.evListenSlot = ''; (reader.querySelector('.ev-reading-head .ev-byline') || reader.querySelector('.ev-reading-head h1')).after(slot) }
  slot.replaceChildren(entry);
  // En la barra entra en el sitio que la página le guarda, para no desplazar a los demás controles.
  if (gap?.isConnected) gap.replaceWith(button); else (toolbar.querySelector('[data-ev-pdf]') || toolbar.lastElementChild).after(button);
  toolbar.append(panel);
  paint();
  reader.dataset.evAudio = 'ready';
  return true;
}
