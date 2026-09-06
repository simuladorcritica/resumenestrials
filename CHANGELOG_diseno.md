# CHANGELOG de diseño — Resúmenes Trials

Registro de cambios del rediseño estético (prompt v3), fase por fase. Comentarios en español. Ningún cambio se publica a `main` por esta vía; cada fase queda en una rama para revisión humana.

## Fase 0 — Mapa y decisión de arquitectura (sin cambios de código)

Ver `INFORME_FASE0_MAPEO.md` (entregado aparte). Resumen: se verificó el prompt v3 contra el código real; se corrigieron varios supuestos (39 ensayos, no 115; no existe `site-runtime.css`; 78 páginas `resumen/*.html` huérfanas; 19 estilos `rt-*` inyectados, no ~18) y se confirmaron los hallazgos críticos (failsafe de opacidad, bug de ancho, ~130 literales de color, 3 paletas superpuestas).

## Fase 1 — Fiabilidad primero (rama `fase-1-fiabilidad`)

**Qué cambió:** `future-experience-patch.css`, líneas 2-5.

**Por qué:** el body quedaba en `opacity:0` con una animación que solo lo revelaba a los 2.5s (`rt-legacy-failsafe`), y solo si `future-experience.js` llegaba a añadir la clase `.rt-future`. Si el script no cargaba o no ejecutaba (bloqueador de anuncios, red lenta, JS deshabilitado o roto), la página podía quedar en blanco. Esto va en contra del requisito de fiabilidad: "el HTML/CSS base debe verse bien sin JS".

**Qué se hizo:** se eliminó la regla `body:not(.rt-future){opacity:0;...}` y el `@keyframes rt-legacy-failsafe`. Ahora `body{opacity:1}` de forma incondicional. El HTML servido sin `.rt-future` ya tiene su propio diseño editorial completo (paleta clara, tipografía Fraunces/Newsreader/IBM Plex Mono ya presentes en el marcado base) — no dependía de JS para verse bien, solo para revelarse. El JS (`future-experience.js` y la cadena que añade `.rt-future*`) sigue funcionando exactamente igual como mejora progresiva hacia el tema oscuro "Future"; no se tocó ningún selector `.rt-future*` ni la lógica de detección de ruta.

**Qué se dejó intacto:** toda la lógica JS (`inferSubspecialty`, filtros, búsqueda, `jsPDF`/`sanPDF`, guardas de re-ejecución), `resumenes.json`, los 19 enganches `rt-*` inyectados, y el resto de `future-experience-patch.css` (glow del puntero, reglas de `.rt-future-*`, etc.).

**Verificación realizada:**
- `node --check` sobre los 14 scripts de la cadena "future" + pdf: sin errores (no se modificó JS).
- Revisión estática: ningún otro archivo CSS/JS depende de `rt-legacy-failsafe`, del `opacity:0` inicial, ni de un `body` invisible antes de `.rt-future` (se comprobó `future-experience.js` y toda la cadena `fix-v4*`/`reader-*`).
- No se corrió el smoke test con navegador real (`scripts/future-experience-smoke.mjs`, que usa Playwright) porque Playwright no está instalado en este entorno de trabajo; el cambio es una regla CSS de una línea sin animaciones ni casos borde adicionales. Recomiendo correr `.github/workflows/future-experience.yml` (o el smoke test local) sobre esta rama antes de fusionar, como hace el propio CI en cada PR.

**Pendiente / fuera de alcance de esta fase:** el resto de la deuda (paletas superpuestas, bug de ancho, tema claro/oscuro real, modo lectura, impresión) se aborda en las fases 2 a 5, cada una con su propio gate de aprobación.
