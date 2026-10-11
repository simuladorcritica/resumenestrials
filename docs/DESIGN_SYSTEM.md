# Sistema de diseño: Nova

## Objetivo
Una publicación de evidencia clínica futurista pero práctica: cualquier persona, aunque no conozca el tema ni use páginas web con frecuencia, debe poder encontrar un ensayo, leerlo completo o breve, descargarlo en PDF y volver a la lista sin explicación previa. El contenido clínico de `resumenes.json` no se modifica: solo cambia la presentación. El logo original se conserva sin transformaciones.

Prioridad: integridad del contenido → funcionalidad → facilidad de uso → estética.

## Tokens (`ui/tokens.css`)
Los literales de color viven exclusivamente en `ui/tokens.css`; las reglas de `ui/site.css` usan variables. Los temas claro y oscuro se diseñan por separado.

| Familia | Oscuro («noche índigo») | Claro («blanco frío») |
|---|---|---|
| Fondo | #070b16 | #f3f5fb |
| Superficie | #0f172b | #ffffff |
| Superficie elevada | #16203a | #eef2fa |
| Texto | #edf1ff | #0c1428 |
| Texto secundario | #a6b0cf | #4a5573 |
| Línea | #233154 | #d6ddec |
| Acento (enlaces, activo) | azul eléctrico #7ab8ff | #1f56d1 |
| Botón principal | #4c8dff + texto #050a16 | #1f56d1 + texto blanco |
| Degradado de marca | azul → violeta → magenta | azul → violeta |
| Medicina Crítica (categoría) | coral #ff9f80 | #b23c10 |
| Medicina Interna (categoría) | violeta #b9a2ff | #6236cc |
| Superficie de modo lectura | #0d0f17 | #fbf8f2 |

Los colores de categoría identifican especialidades; nunca valoran resultados. Contraste mínimo 4,5:1 comprobado con axe en ambos temas.

Tipografías (Google Fonts, `display=swap`): **Sora** para interfaz y titulares; **Literata** para lectura larga. Lectura: 20 px por defecto (18/22 con el botón Letra), interlineado 1,78 y máximo 70 caracteres por línea. Radios 10/16/24 px y píldoras; sombras suaves; movimiento 160/220 ms, desactivado con `prefers-reduced-motion`. Fondo con aurora tenue y vidrio translúcido en cabecera y barras.

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

## PDF (`ui/pdf.js`)
Generador único jsPDF 4.2.1 con SRI y `sanPDF()`. Banda superior azul/violeta, logo en la cabecera y marca de agua en todas las páginas, títulos de sección con barra violeta, cuerpo Times justificado, pie con enlace canónico, redes y correo. El texto y el orden de los PDF no cambian.

## Arquitectura
Una sola capa: `ui/tokens.css` + `ui/site.css` → `site-runtime.css`; `ui/core.js`, `ui/archive.js`, `ui/reader.js`, `ui/forms.js` (más el clasificador y el contexto de lectura) → `site-runtime.js`. Las páginas salen de `site_templates.py`. Los IDs y atributos `data-ev-*` son contratos funcionales con las pruebas. Sin `<style>` inyectados, ≤ 10 `!important`, CSS ≤ 70 KB y JS propio ≤ 90 KB.

## Criterios obligatorios
Texto renderizado y datos sin cambios; un único buscador por página; claro, oscuro y modo lectura persistentes; PDF completo y breve en Celular y A4; Chromium y WebKit a 390/1440 en ambos temas; axe sin infracciones serias o críticas; sin desbordamiento; ≤ 3 toques para las tareas principales.
