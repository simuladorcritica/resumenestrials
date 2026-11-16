# Arquitectura

## Fuente y salidas

- `resumenes.json`: fuente clínica canónica.
- `auditoria-editorial.json`: fuente de transparencia editorial (schema_version 1) que regeneran a diario las rutinas locales; no se genera en el build. Alimenta el aviso «Resumen en revisión» (IDs en `sin_auditar` o, con precedencia, en `con_errores_abiertos`), la «Fe de erratas» de cada resumen (`correcciones`) y `/correcciones/`. Es opcional: si falta, no es válido o un ID no aparece, no se muestra aviso ni fe de erratas. Ambos bloques quedan fuera de `<article class="articulo">`, así que no alteran el cuerpo clínico congelado. El lector dinámico (`resumen.html?id=`) lo descarga en paralelo con el ensayo (`E.audit()` en `ui/core.js`) y usa el mismo marcado que `site_templates.py`.
- `_includes/index-source.html`: portada prerenderizada (la edición actual) usada por Jekyll; `index.html` es su copia exacta. Es también la fuente de su propio `<head>` (canonical, JSON-LD `WebSite`/`Organization`, Open Graph): cada generación lo conserva.
- `archivo/index.html`: archivo completo con todos los resúmenes prerenderizados, buscador y filtros (antes vivía en la portada).
- `ediciones/<lunes ISO>/index.html`: una página por cada edición semanal anterior. La edición actual no tiene página propia: es la portada.
- `mapa/index.html`: mapa de evidencia, con un punto por resumen ya en el HTML (vista por tema) y las rutas de los ensayos incrustadas.
- `preguntas/<slug>/index.html`: una página por pregunta clínica de `preguntas-clinicas.json`.
- `trials/*/index.html`: páginas canónicas indexables.
- `resumen/*.html`: compatibilidad social/legada, `noindex` y canonical al trial.
- `seo-manifest.json`, `seo-cluster-manifest.json`, `sitemap.xml`: salidas SEO.
- `images/trials/*`: imágenes sociales generadas.
- `site_templates.py`, `templates/account/`, `templates/documents/`: presentación común y fuentes de formularios/documentos. `templates/` se excluye de Jekyll.
- `ui/tokens.css` y `ui/site.css`: tokens y reglas; ninguna inyección de estilos en ejecución.
- `ui/core.js`, `ui/archive.js`, `ui/reader.js`, `ui/forms.js`: módulos agrupados junto con `specialty-classification.js` y `reading-context.js`.
- `map-page.js`: módulo propio de `/mapa/` (reagrupar, filtrar, resaltar y abrir el panel de una casilla). No forma parte del runtime; la página lo carga con la huella de su contenido en la URL, así que cambiarlo exige regenerar.
- `ui/pdf.js`: generador único A4/celular, completo/breve, con la identidad editorial (monograma y línea de señal en la página 1, retícula marginal en A4, fuentes OFL incrustadas desde `fonts/pdf/` bajo demanda); jsPDF 4.2.1 con SRI.
- `fonts/pdf/*.ttf` y `tools/fonts/*.ttf`: subconjuntos OFL (Newsreader, Literata e IBM Plex renombrada RTSans) para el PDF y las tarjetas sociales; se regeneran con `tools/fonts/construir_fuentes_pdf.py`.
- `site-runtime.js` y `site-runtime.css`: bundles generados; sus fuentes permanecen separadas para mantenimiento.

## Generación reproducible

```text
node scripts/build-site-runtime.mjs
python generar_seo.py
python generar_seo_semantico.py
python generar_seo_avanzado.py
python restaurar_arquitectura.py
python actualizar_agregar_editorial.py
python generar_paginas_sociales.py
python aplicar_experiencia_futura.py
```

El runtime va primero (como en `CLAUDE.md` y en los workflows): además de los bundles escribe el índice ligero `datos/indice.json`, del que el mapa de evidencia toma la subespecialidad inferida de cada resumen.

Los archivos generados se versionan para que GitHub Pages pueda servirlos sin una plataforma de construcción adicional. Los cambios manuales en salidas generadas serán sobrescritos.

Una edición agrupa los resúmenes cuya `fecha_publicacion_resumen` cae en la misma semana ISO (lunes a domingo); `site_templates.editions()` es la única regla y `scripts/editions.mjs` la repite para las pruebas. La edición actual es la última semana con datos, no la fecha del día: la generación no depende de cuándo se ejecuta. Cuando empieza una semana nueva, la anterior recibe su página en `ediciones/` y entra en el sitemap y en `llms.txt`. La portada se escribe dos veces con el mismo resultado (`generar_seo_avanzado.update_home()` y `site_templates.render_all()`); el archivo, el mapa y las ediciones los escribe `render_all()`. Un resumen sin fecha de publicación válida no entra en ninguna edición y sigue en el archivo. Desde el 16-nov-2026 la portada y cada edición muestran tarjetas en orden de publicación en el sitio (`site_templates.published()`: `fecha_publicacion_resumen` más reciente primero; empate: id más alto; `scripts/editions.mjs` repite la regla): la portada lleva todos los resúmenes y cada edición anterior los de su semana. `feed()` escribe todas las tarjetas en el HTML, ocultas a partir de la decimotercera, con la subespecialidad tomada de `datos/indice.json` (`_sub`, el mismo dato que usa el archivo); «Ver más» las va mostrando (`ui/core.js`). La portada pesa por eso lo mismo que el archivo (una tarjeta por resumen).

Las preguntas clínicas (`preguntas-clinicas.json`, fuente) reúnen ensayos ya resumidos sobre una misma pregunta. `site_templates.question_page()` escribe `/preguntas/<slug>/` con una ficha breve por ensayo del núcleo, en orden cronológico del artículo. Principio editorial: la página es un resumen —de cada ensayo, solo lo esencial para situarlo; el detalle está en su resumen, que la ficha enlaza—, pero breve no es incompleto: lo que cambia cómo se interpreta el hallazgo no se omite.

**Qué lleva cada ficha.** Los campos `objetivo` y `hallazgo` del resumen, tal cual, y un bloque «Para interpretarlo» con tres frases breves guardadas en el archivo, cada una en su apartado: a quién se incluyó de verdad, cómo se separaron los grupos y la limitación principal. «Cómo leerlos juntos» compara el diseño con una frase breve por ensayo y eje. Cada pregunta declara sus `ejes` (su lista de comprobación), con `tipo` (`diseno`, `contexto`, `literal` o `ausencia`), `lugar` (`ficha` o `juntos`), `obligatorio`, `max` (longitud máxima de la frase) y una `guia` interna. Cada frase lleva su cita literal del resumen; si el resumen no da el dato central de un eje, la entrada es `sin_dato` y la página lo dice («El resumen de X no informa …»).

**Constancia de decisión (que ningún resumen nuevo quede sin comparar).** Cada pregunta guarda `revisado_hasta`, el id del último resumen que cubrió su curación. Todo resumen posterior debe estar en la pregunta (núcleo o relacionados) o tener anotada su decisión para ella en `decisiones`: `nada` (los dos decisores coinciden en que no pertenece), `duda` (difieren: no se añade y lo resuelve el editor) o `sin_anadir` (pertenece, pero no pasó la revisión: lo resuelve el editor). La anota `python tools/preguntas_clinicas.py decidir --id N --constancia DECISION.json`, que exige una decisión por cada pregunta pendiente, el veredicto del decisor independiente y, como prueba de lectura, un pasaje literal de ese resumen; solo añade, nunca cambia una decisión. `validar` lista `SIN DECIDIR · resumen N · <slug>` y `POR RESOLVER · …`, y `criterios` entrega `sin_decidir` a la rutina, que los compara en cada ejecución (no solo los del PR en curso). Un resumen sin decidir no es un error de CI: su alta se publica igual y la comparación se hace en la pasada siguiente; el motor de mantenimiento avisa si alguno sigue sin decidir pasado un día.

**Preguntas nuevas (decisión del editor, 16-nov-2026: «automático con candados»).** Una pregunta solo nace con `python tools/preguntas_clinicas.py crear --propuesta PREGUNTA.json` (con `--ensayo` comprueba sin escribir); nadie edita el archivo a mano. La propuesta trae la pregunta completa (slug, pregunta, nombre, descripción, condición, área, criterio, criterio de relacionados y ejes con su guía) y su núcleo, y la herramienta exige todos estos candados o no escribe nada: tres ensayos o más en el núcleo (`QUESTION_MIN_CORE`), ninguno en el núcleo de otra pregunta; de cada ensayo, la decisión de pertenencia con los dos decisores de acuerdo y un pasaje literal de su resumen, las tres revisiones independientes en VERDE y sus frases dentro de las guardas de siempre (cita literal, cifras en la cita, máximo por eje); la revisión independiente de la pregunta en VERDE (`marco`: que prometa solo lo que sus ensayos responden, criterio preciso, ensayos comparables); el barrido de todo el archivo con los decisores de acuerdo (`barrido.hasta` igual al id más alto de `resumenes.json`; de ahí sale `revisado_hasta`); que no exista ya una pregunta con ese slug, título o nombre; y como máximo una pregunta nueva por día. De todo ello queda la constancia `creacion` (fecha, marco, barrido), que `parse_questions()` exige a toda pregunta publicada después del 15-nov-2026: una pregunta añadida a mano no valida y el PR no se fusiona. `criterios` entrega en `crear` lo que la rutina necesita (mínimo de ensayos, último id, ensayos ya en algún núcleo y si hoy ya se creó una). En la portada, `question_cover()` da tarjeta a las tres preguntas más recientes (`QUESTION_HOME`) y enlaza las demás en un desplegable; las especialidades siguen enlazando todas las suyas.

**Presentación.** La página no lleva rótulo sobre el título. `question_timeline()` pinta la línea de tiempo (año, sigla y revista de cada ensayo del núcleo); cada punto enlaza a la ficha (`id="ensayo-<id>"`), que se resalta con `:target`. Las fichas van siempre todas a la vista, en dos columnas: «Qué preguntó» y «Hallazgo principal», y «Para interpretarlo» con un apartado por eje de ficha. «Cómo leerlos juntos» tiene un panel por eje con una fila por ensayo; las pestañas son botones de opción y el panel se elige con `:has()`, sin JavaScript: sin `:has()` o al imprimir se ven todos los paneles. Los rótulos de pestañas y apartados son texto de interfaz, no clínico: salen de `QUESTION_AXIS_LABELS` por la clave del eje, o del `rotulo` que el eje fije en `preguntas-clinicas.json` (sin cifras ni lenguaje de resultado). `question_cover()` añade a la portada, entre la edición y la franja del mapa, una tarjeta por pregunta con su línea de tiempo; no muestra hallazgos, que solo van en la página junto a sus límites. Los estilos están en `ui/preguntas.css`, una hoja propia fuera del runtime único (que tiene tope de 70 KB): `document()` la enlaza solo en `/preguntas/…` y en la portada, con la huella de su contenido en la URL (`question_css()`), y `scripts/validate-design.py` comprueba que ninguna otra página la carga.

**Guardas mecánicas.** `question_entry_text()` decide qué se publica: una frase debe empezar por la sigla del ensayo, ser una sola oración dentro de su máximo, no nombrar a otro ensayo, no llevar consejos ni juicios (ni resultados, en un eje de diseño), y cada cita debe seguir literalmente en el resumen y contener todas las cifras de la frase; un `sin_dato` va sellado con la huella del resumen (`summary_print()`) y caduca si el resumen cambia. Lo que no cumple **se omite solo** (por ejemplo, cuando una corrección cambia el pasaje citado): nunca queda un dato desfasado. `scripts/validate-design.py` comprueba de forma independiente que lo publicado coincide con lo que pasa las guardas. La descripción se genera con las siglas del núcleo (`question_description()`).

**Añadir un ensayo.** El archivo no se edita a mano: `tools/preguntas_clinicas.py` lo escribe y solo sabe añadir (`agregar`, que exige todos los ejes obligatorios) y reponer lo que el sitio ya omite (`reponer`); `criterios` devuelve las reglas de pertenencia y de redacción, los criterios de cada pregunta y sus ejes; `validar` informa de lo omitido. La rutina que publica resúmenes la usa para añadir cada ensayo nuevo a su pregunta en el mismo PR del alta, con tres revisores independientes (cotejo, fiscal y omisiones). `tools/test_preguntas_clinicas.py` prueba las guardas y la herramienta.

`question_block()` añade al final de cada ensayo del núcleo el enlace a su pregunta y a los otros ensayos, y a los relacionados un «Ver también»; `question_links()` lista las preguntas en el hub de su especialidad. Las páginas entran en el sitemap (con su fecha de revisión) y en `llms.txt`. Un dato inválido en el archivo detiene la generación. Quien versiona las salidas con una lista fija debe incluir `preguntas/` y `preguntas-clinicas.json`.

El mapa de evidencia (`site_templates.evidence_map()`) coloca cada resumen en una columna (año del artículo) y una fila: los de Medicina Crítica en su subtema de `seo-cluster-manifest.json` y los de Medicina Interna en su subespecialidad inferida. Esa subespecialidad es la del archivo: no se recalcula en Python, se lee del campo `_sub` de `datos/indice.json`, que escribe `scripts/build-site-runtime.mjs` con `specialty-classification.js`. Si el índice no incluye algún resumen, la generación se detiene y pide ejecutar ese paso; `validate-data.mjs` ya exige que el índice esté al día. `scripts/evidence-map.mjs` repite la regla con el clasificador para las pruebas. La franja de la portada solo necesita el área y el año de cada resumen.

Quien versiona las salidas con una lista fija de rutas debe incluir `archivo/`, `mapa/` y `ediciones/`: el workflow `actualizar-sitemap` ya las añade.

La secuencia debe ser idempotente: dos ejecuciones consecutivas tienen que producir las mismas salidas. `sitemap.xml` solo publica `lastmod` cuando existe una fecha editorial explícita (`fecha_revision`, `actualizado` o `fecha_publicacion_resumen`); la fecha de publicación del estudio no representa una modificación del sitio.

`fecha_publicacion_resumen` es la fecha editorial explícita de publicación web para altas futuras. Es independiente de `fecha`, que conserva la fecha bibliográfica. No se completa retroactivamente ni se infiere a partir de la publicación científica. Cuando es una fecha ISO real, la alta entra automáticamente al feed Atom.

`restaurar_arquitectura.py` y `aplicar_experiencia_futura.py` conservan sus nombres por compatibilidad de automatización, pero llaman al nuevo renderizador común. La última aplicación refresca las versiones después del build. Las rutas legadas permanecen `noindex`; `resumen.html?id=` usa el mismo lector con datos públicos y valida el ID antes de cargar publicidad. Sin JavaScript, cada canónica y página legada presenta su contenido completo; el lector con query ofrece enlaces canónicos de los 168 ensayos.

El runtime usa hashes deterministas con saltos de línea LF e incluye el módulo PDF en la versión. Auth, biblioteca, recomendaciones y Turnstile conservan sus APIs y comportamiento. El despliegue de backend Auth es manual y requiere opt-in; las verificaciones automáticas usan dobles locales.

## Vigilancia posterior a la publicación

El workflow privado de Search Console vuelve a calcular el inventario en cada ejecución y conserva únicamente un snapshot técnico privado, sin métricas GSC, mediante GitHub Actions Cache. Así detecta altas, eliminaciones y modificaciones por ID, DOI y canonical, mantiene la primera fecha de detección y mueve automáticamente cada alta entre `D0_6`, `D7_13`, `D14_27`, `D28_59`, `D60_89` y `D90_PLUS`. Los artículos sin fecha editorial fiable permanecen en `LEGACY` y nunca reciben una fecha inventada.

La observación separa `PUBLISHED`, `DISCOVERABLE`, `INDEXED` solo cuando URL Inspection puede confirmarlo, `WITH_IMPRESSIONS` y `WITH_CLICKS`. D0–13 se limita a controles técnicos, D14–27 es preliminar y las oportunidades reales requieren D28+ o un artículo `LEGACY` con volumen suficiente. Los informes comparan denominadores elegibles propios de cada periodo y agrupan tendencias por cohorte de edad, semana y mes de publicación; el crecimiento mensual del inventario se presenta separado del rendimiento por artículo elegible. Cero impresiones nunca se interpreta como prueba de no indexación. Los datos GSC y reportes detallados se crean en `$RUNNER_TEMP/gsc/`, se incluyen únicamente en el correo administrativo privado de Resend y se eliminan al final; el cache de inventario no contiene clicks, impresiones, queries, CTR ni posición.

## Servicios

- GitHub Pages: alojamiento y dominio personalizado mediante `CNAME`.
- Supabase: Auth, perfiles, MFA y Edge Functions.
- Cloudflare Turnstile: protección anti-bot; el secreto vive en GitHub/Supabase.
- Resend: avisos de nuevos resúmenes.
- Google AdSense: publicidad declarada en el aviso de privacidad.

Las dos Edge Functions usan imports npm fijados y se resuelven con Deno 2 mediante `deno.json` y `deno.lock`. La prueba positiva de Auth en pull requests sustituye Supabase por un doble local y bloquea cualquier tráfico al proyecto real.

## Secretos requeridos

`SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY` y `RESEND_API_KEY`. Nunca se incorporan a JavaScript público ni al historial Git, y solo se inyectan en pasos de workflow que no se ejecutan para `pull_request`.

## Fiabilidad del entorno y alertas

- Los flujos de GitHub usan imágenes fijas (`ubuntu-24.04`, `windows-2025`), no `*-latest`, para que una migración de GitHub no cambie fuentes del sistema ni navegadores sin aviso.
- Antes de cada barrido, los flujos esperan a que el servidor local responda (hasta 60 s, con reintentos) en lugar de una pausa fija.
- jsPDF 4.2.1 se sirve desde `vendor/jspdf-4.2.1/` (mismos bytes y SRI que cdnjs): una caída del CDN no rompe las descargas. `validate-resumen-page.mjs` comprueba la ruta y el SRI.
- `alertas-produccion.yml` avisa por Telegram cuando una verificación de `main` falla dos veces seguidas y cuando se recupera. Secretos: `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`.
- `regenerar-pr-en-conflicto.yml` integra `main` en los PR `claude/*` que solo chocan en salidas generadas y las regenera con `scripts/regenerar-pr-en-conflicto.sh`. Si el conflicto toca fuentes, comenta en el PR. Secreto: `RT_AUTOMATION_TOKEN` (un push con el token automático de GitHub no relanza las comprobaciones obligatorias). Límite conocido: una tarjeta social que `main` ya generó no se rehace sola; si el PR cambia el diseño de las tarjetas, hay que borrar las nuevas y regenerarlas.
