# Sistema de diseño: identidad editorial (web, PDF y tarjetas)

## Objetivo
Una publicación de evidencia clínica sobria y práctica: cualquier persona, aunque no conozca el tema ni use páginas web con frecuencia, debe poder encontrar un ensayo, leerlo completo o breve, descargarlo en PDF y volver a la lista sin explicación previa. El contenido clínico de `resumenes.json` no se modifica: solo cambia la presentación. El logo original se conserva sin transformaciones. Desde noviembre de 2026 la web comparte la identidad editorial del PDF y de las tarjetas (sustituye a Nova).

Prioridad: integridad del contenido → funcionalidad → facilidad de uso → estética.

## Tokens (`ui/tokens.css`)
Los literales de color viven exclusivamente en `ui/tokens.css`; las reglas de `ui/site.css` usan variables. El tema claro («papel») es el predeterminado; el oscuro («tinta nocturna») se activa por preferencia del sistema o con el botón.

| Familia | Claro («papel») | Oscuro («tinta nocturna») |
|---|---|---|
| Fondo | #f6f4f0 | #0f1b2d |
| Superficie | #ffffff | #15243a |
| Superficie elevada / suave | #efebe3 | #1b2c45 |
| Titulares (tinta) | #12233b | #ede9e1 |
| Texto | #1e2733 | #e4e0d8 |
| Texto secundario | #5a6372 | #a9b2bf |
| Línea | #ddd8cc | #2a3b55 |
| Acento (enlaces, activo) | petróleo #146e6e | #5fbfbc |
| Botón principal | tinta #12233b + texto papel | papel #ede9e1 + texto tinta |
| Marca (línea de señal) | #1c8a8a | #5fbfbc |
| Punto ocre (solo línea de señal) | #c8892a | #e0a84a |
| Medicina Crítica (categoría) | #a8472a | #e08a6a |
| Medicina Interna (categoría) | #146e6e | #5fbfbc |

Los colores de categoría identifican especialidades; nunca valoran resultados. Contraste mínimo 4,5:1 comprobado con axe en ambos temas.

Tipografías propias (`/fonts/`, WOFF2, OFL): **Newsreader** para titulares y marca; **RT Sans** (IBM Plex Sans renombrada) para interfaz; **Literata** para lectura larga. Lectura: 20 px por defecto (18/22 con el botón Letra), interlineado 1,78 y máximo 70 caracteres por línea. Sin degradados, vidrio, aurora ni sombras: superficies planas, filetes de 1 px y radios de 2–4 px. Las tarjetas del archivo se separan con un filete superior en tinta, sin caja. Las etiquetas son versalitas sin píldora. Movimiento 160/220 ms, desactivado con `prefers-reduced-motion`.

**Línea de señal en la web.** Aparece una sola vez por página: bajo el titular de la portada y en la cabecera del lector (`SIGNAL` en `site_templates.py` y su equivalente en `ui/reader.js`). Es el único uso de `var(--ev-dot)`; `validate-editorial.mjs` lo comprueba.

El CSS servido (`site-runtime.css`) se genera sin comentarios ni saltos de línea; las fuentes en `ui/` se mantienen comentadas. Objetivo ≤ 60 KB (límite duro 70 KB).

## Responsive y dispositivo
- Celular < 720 px · tableta 720–1099 px · escritorio ≥ 1100 px; navegación completa en cabecera desde 1240 px.
- `data-ev-device` (`movil|tableta|escritorio`) y `data-ev-pointer` (`tactil|raton`) se fijan en `<head>` antes de pintar y se actualizan al redimensionar. Se usan para el formato PDF recomendado, ocultar atajos de teclado en pantallas táctiles y el texto de ayuda del buscador.
- Controles de 44 px mínimo. Sin desbordamiento horizontal desde 320 px.

## Componentes
- **ev-header**: logo, navegación (Inicio, Medicina Crítica, Medicina Interna, Mi biblioteca), **buscador único**, tema claro/oscuro y Cuenta. En tableta y en páginas de formulario, botón Menú.
- **Buscador único (`#ev-q`)**: un solo campo por página, siempre en la cabecera. En portada, especialidades, subtemas y biblioteca filtra la lista de la página mientras se escribe (estado en `?q=`). En el resto muestra resultados instantáneos con coincidencias resaltadas, teclado (↑ ↓ Enter Esc) y «Ver todos los resultados». Atajos `/` y Ctrl/Cmd+K en escritorio. Sin JavaScript, el formulario envía a `/?q=`.
- **ev-mobile-nav**: barra inferior en celular con Inicio · Especialidades · Biblioteca · Menú; en lectura la sustituye la barra de lectura.
- **ev-hero**: portada con título, cifras del archivo y franja «Cómo usar» en 3 pasos; versión compacta en especialidades y subtemas.
- **ev-archive**: selector segmentado de especialidad con contadores, atajos (Medicina Crítica + año y temas frecuentes), panel plegable «Filtros» (subespecialidad, tema, año, revista, tipo de estudio, orden), chips removibles, «Limpiar todo», vista compacta y «Mostrar más». Estado en la URL (`q`, `esp`, `sub`, `tema`, `anio`, `revista`, `tipo`, `orden`, `vista`, `n`); `?esp=` heredado con una subespecialidad sigue funcionando.
- **ev-card**: empieza por el título; después revista y fecha, categoría y subespecialidad, temas, ficha del estudio plegable, tiempo estimado de lectura (completo y breve), «Leer» y menú PDF (completo o breve). Solo campos existentes; el tiempo de lectura se calcula por número de palabras (230 por minuto).
- **ev-reader**: hallazgo principal destacado, ficha técnica plegable, barra de lectura (Completo/Breve · Índice · PDF · Modo lectura · Guardar · Compartir · Letra), índice lateral con sección activa en escritorio, progreso, Anterior/Siguiente, evidencia relacionada y «Volver a la lista». En celular la barra va abajo y Guardar, Compartir y Letra quedan en «Más».
- **Modo lectura**: oculta cabecera, pie, ficha, índice lateral y relacionados; superficie de lectura cálida; persiste (`ev-focus`) y se cierra con Esc (después de cerrar diálogos).
- **Panel PDF (`#ev-pdf-dialog`)**: versión (Completo/Breve, preseleccionada la actual) y dos botones directos de formato (Celular / Computadora A4); el recomendado para el dispositivo aparece primero y resaltado.
- **ev-dialog**: hojas inferiores en celular y diálogos/cajón en escritorio; foco atrapado y restaurado, Esc y clic fuera cierran.
- **ev-footer**: marca, Explorar, Transparencia, Comunidad, aviso de privacidad/AdSense y aviso clínico.
- **Botón «Volver arriba»** tras dos pantallas de desplazamiento.

## Texto justificado
Todo párrafo de prosa (cuerpo, breve, documentos, avisos, textos de apoyo) y las listas largas se justifican con partición `es-MX`, guion ASCII y última línea al inicio. Títulos, metadatos (revista, fecha, tiempo de lectura), etiquetas, estados y controles conservan alineación al inicio. `ui/core.js` añade cortes visuales vacíos que no alteran `textContent`, selección ni el HTML clínico; la puntuación final no convierte una palabra en token técnico.
En celular (pantallas de hasta 480 px) la prosa se alinea a la izquierda con la misma partición: en columnas tan angostas el justificado abría huecos de más de 2em entre palabras (139 de 231 resúmenes con letra grande). Tablet, escritorio y PDF siguen justificados. Decisión del editor, octubre de 2026.

## Tipografía
Literata, Newsreader y RT Sans se sirven desde `/fonts/` (WOFF2, latin y latin-ext, licencia OFL) con `font-display: swap`. Ninguna página depende de Google Fonts: una hoja de estilos externa bloquea el primer render y dejaba la pantalla en blanco en redes móviles. `validate-editorial.mjs` falla si vuelve a aparecer.

## Identidad editorial: PDF y tarjetas sociales
Alcance: los PDF descargables y las imágenes para X, Telegram y Google; la web aplica la misma identidad con los tokens de arriba. Todo sale del logo (`logo.png`): el papel crema del círculo, la tinta de la R, el petróleo de la T y el punto ocre en el que termina la curva.

**Línea de señal.** Es un filete petróleo que, en su extremo derecho, sube suavemente y termina en el punto ocre, como la curva del monograma. Aparece una sola vez por pieza: en la cabecera de la página 1 del PDF y en la cabecera de la tarjeta. Es el único uso del ocre; si apareciera en otro sitio, dejaría de significar algo. El monograma conserva su propio punto como parte de la marca (decisión del editor, noviembre de 2026). Se dibuja como trazo vectorial: curva de Bézier en jsPDF y polilínea muestreada en Pillow, con supermuestreo 2×.

| Token | Valor | Contraste | Uso |
|---|---|---|---|
| Papel | #F6F4F0 | — | Fondo de las tarjetas |
| Papel alterno | #EFEBE3 | — | Recuadro «Puntos clave» del PDF |
| Arena (línea) | #DDD8CC | — | Filetes y pie |
| Tinta | #12233B | 14,4:1 sobre papel | Cabecera y títulos |
| Texto | #1E2733 | 13,7:1 | Prosa |
| Secundario | #5A6372 | 5,5:1 (5,1 sobre papel alterno) | Metadatos y pie |
| Petróleo | #146E6E | 5,5:1 | Enlaces, títulos de sección y Medicina Interna |
| Petróleo de marca | #1C8A8A | 3,8:1 (no se usa en texto) | Línea de señal y filete de «Puntos clave» |
| Ocre | #C8892A | 2,7:1 (no se usa en texto) | Solo el punto de la línea de señal |
| Óxido | #A8472A | 5,3:1 (5,8:1 sobre blanco) | Medicina Crítica |

Los colores de especialidad identifican, nunca valoran resultados. No hay degradados, sombras, píldoras, marca de agua ni transparencias: las superficies se separan con filetes y cambios de fondo, como en una revista impresa.

**Tipografía (OFL, autoalojada).**
- Newsreader para titulares y cabecera. La sigla del ensayo va en seminegrita, porque es como se busca y se cita un ensayo.
- Literata para la prosa; ya era la fuente de lectura del sitio.
- IBM Plex Sans y Plex Sans Condensed para metadatos y versalitas, con 0,08 em de espaciado. IBM Plex tiene el nombre reservado «Plex», así que los subconjuntos se llaman RTSans, como exige la OFL.

Las tres cubren á é í ó ú ü ñ ¿ ¡ « » − ≥ ≤ µ. Los caracteres que una fuente no tiene pasan por `sanPDF()` en el PDF y por `glyph_safe()` en las tarjetas. Quedan prohibidas, por ser firmas de la estética genérica: Inter, Poppins, Montserrat, Playfair Display, Space Grotesk, Fraunces, DM Sans y Sora.

### PDF (`ui/pdf.js`)
Generador único jsPDF 4.2.1 con SRI. Las fuentes (`fonts/pdf/`, unos 500 KB en total) se descargan solo al generar el primer PDF y quedan en memoria. Si fallaran, el PDF se genera igual con las fuentes estándar y `sanPDF()`. El texto, el orden y el contenido no cambian: solo cambia la presentación.
- **Página 1:** a la izquierda, el monograma y «Resúmenes Trials»; a la derecha, el folio (`Resumen N.º {id} · {fecha_publicacion_resumen}`); debajo, la línea de señal. Después vienen el título en Newsreader, sin antetítulo de especialidad ni de tipo de estudio para que se lea limpio, y la línea de referencia con el DOI enlazado y el registro. La versión breve tiene exactamente la misma impresión editorial que la completa; solo la distingue el folio («Resumen breve N.º {id}»; en Celular, «Breve · N.º {id}»).
- **«Puntos clave»:** en las dos versiones (decisión del editor, noviembre de 2026: una sola impresión editorial). El Mensaje sale de la Conclusión de la versión que se descarga. Va sobre papel alterno con un filete superior petróleo de 2 pt. Contiene la Pregunta (`objetivo`), el Hallazgo (`hallazgo`, con su negrita) y el Mensaje (la frase ancla, el `<strong>` de la Conclusión). Si no cabe completo en la página, continúa en la siguiente (con su fondo) en lugar de dejar la página 1 a medias. Como la frase ancla se extrae de mitad de una oración, `tidy()` la presenta con mayúscula inicial y punto final; es solo presentación y `resumenes.json` no cambia.
- **Ficha:** tipo de estudio y fecha de publicación del artículo (sin Especialidad ni Temas, decisión del editor de noviembre de 2026). La financiación abre el cuerpo para que los textos largos fluyan entre páginas.
- **A4:** columna marginal de 118 pt con los títulos de sección en versalitas petróleo, alineados con el primer renglón. Columna de texto de unos 68 caracteres (Literata 10/15,5 pt), justificada, sin partir palabras y con sangría en los párrafos siguientes. Se conservan las negritas del resumen.
- **Celular (320 × 640 pt):** una sola columna, con los títulos de sección encima del texto y Literata 13/19 pt alineada a la izquierda (la misma decisión que la web en pantallas de hasta 480 px).
- **Páginas interiores:** encabezado con filete arena y sin punto.
- **Pie de cada página:** filete arena, «Resúmenes Trials · Editorial EMEICRÍTICA», «Página X de N» y la URL canónica enlazada. En Celular dice «resumenestrials.com · Resumen N.º …», enlazado a la canónica.
- **Última página:** «Cómo citar este resumen» con dos formatos únicamente: APA (`Editorial EMEICRÍTICA. ({año}, {día} de {mes}). *{título}*. Resúmenes Trials. {URL}`) y Vancouver (`Editorial EMEICRÍTICA. {título} [Internet]. Resúmenes Trials; {año} {mes abreviado} {día} [citado {fecha de descarga}]. Disponible en: {URL}`), el aviso («Resumen crítico independiente; no sustituye la lectura del artículo original y puede contener errores; las correcciones se publican en la web») y los contactos.
- **Sin marca de agua:** las revistas serias no la usan; el monograma va en la cabecera. Es reversible.

### Tarjetas sociales (`generar_seo_avanzado.py → make_image`)
La tarjeta es la primera página de un artículo, no un anuncio. Se genera en 1280×720 (16:9), 1200×900 (4:3) y 1200×1200 (1:1), con los mismos nombres de archivo (`<slug>-16x9.jpg`, etc.).
- **Fondo:** papel.
- **Cabecera:** monograma y «Resúmenes Trials»; a la derecha, la especialidad en versalitas de su color y `N.º {id}`. Debajo, la línea de señal.
- **Antetítulo:** en petróleo (`ENSAYO CLÍNICO ALEATORIZADO · {revista corta} {año}`). Nunca llama ECA a un metaanálisis ni a un análisis secundario.
- **Título:** completo, en Newsreader, con la sigla en seminegrita. Hasta 4 líneas en 16:9 y hasta 6 en 4:3 y 1:1. Primero se reduce el cuerpo de letra; si aun así hay que cortar, se corta por palabra completa y con «…».
- **Pie:** filete arena, «Editorial EMEICRÍTICA» y «resumenestrials.com».

Solo se usa texto ya publicado. Si falta una fuente, la generación se detiene. Una imagen existente no se regenera (idempotencia); para un rediseño, se borran todas y se regeneran en el mismo PR.

## Arquitectura
Una sola capa: `ui/tokens.css` + `ui/site.css` → `site-runtime.css`; `ui/core.js`, `ui/archive.js`, `ui/reader.js`, `ui/forms.js` (más el clasificador y el contexto de lectura) → `site-runtime.js`. Las páginas salen de `site_templates.py`. Los IDs y atributos `data-ev-*` son contratos funcionales con las pruebas. Sin `<style>` inyectados, ≤ 10 `!important`, CSS ≤ 70 KB y JS propio ≤ 90 KB.

## Criterios obligatorios
Texto renderizado y datos sin cambios; un único buscador por página; claro, oscuro y modo lectura persistentes; PDF completo y breve en Celular y A4; Chromium y WebKit a 390/1440 en ambos temas; axe sin infracciones serias o críticas; sin desbordamiento; ≤ 3 toques para las tareas principales.
