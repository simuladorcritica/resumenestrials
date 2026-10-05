# Sistema de diseño: Laboratorio de evidencia

## Objetivo y decisiones
Una publicación clínica con la precisión visual de un instrumento: superficies técnicas, jerarquía clara, datos bibliográficos completos y lectura sin distracciones. El logo original se conserva sin transformaciones. No se generan ni se infieren datos clínicos.

## Tokens
| Familia | Oscuro | Claro |
|---|---|---|
| Fondo | grafito azulado #0b111a | blanco frío #f5f8fc |
| Superficie | #111c29 | #ffffff |
| Superficie secundaria | #182637 | #eaf0f7 |
| Texto | #edf4fc | #142335 |
| Texto secundario | #a7bacf | #43566e |
| Línea | #304358 | #c6d3e2 |
| Acento | cian teal #55dfd1 | teal #006d68 |
| Señal | ámbar #f0bd62 | ámbar oscuro #865400 |
| Error | #ff9caa | #a51f3d |

Los literales de color viven exclusivamente en ui/tokens.css; las reglas usan variables. Contraste previsto mínimo 4,5:1, sujeto a comprobación automática en cada tema.
Tipografías: Inter Tight para interfaz y titulares; Source Serif 4 para texto largo; JetBrains Mono para datos. Google Fonts con display=swap y fallbacks del sistema.
Escala: 4, 8, 12, 16, 24, 32, 48, 64 y 96 px. Radios: 4/8/12 px. Bordes: 1 px. Sombras suaves definidas mediante tokens. Movimiento: 180/220 ms; reducido desactiva animaciones. Fuente de lectura 18–22 px y 70ch.
Responsive: 360–719 px móvil; 720–1099 tablet; 1100+ escritorio. Cabecera 72 px escritorio /64 px móvil. Controles de 44 px mínimo.

## Componentes
- ev-header: una fuente Python común, logo, navegación completa, cuenta, biblioteca, búsqueda y tema.
- ev-mobile-nav: Inicio/Buscar/Especialidades/Biblioteca; sustituida por controles en el lector.
- ev-search: diálogo accesible, atajos, resultados con coincidencias, teclado y cierre Esc.
- ev-archive: mismo motor para archivo y hubs, filtros combinables, chips, orden, lista/tarjetas y Mostrar más. Estado en URL e historial.
- ev-card: título original y ficha con campos existentes. Sin cifras inferidas.
- ev-reader: artículo, ficha técnica, índice, progreso y barra persistente; el cuerpo clínico no se reestructura.
- ev-panel: diálogos de secciones y formato PDF; foco atrapado y restaurado.
- ev-form: formularios y cuenta; conserva IDs funcionales y lógica Auth/Turnstile.
- ev-notice: carga/error/vacío/sin sesión.
- ev-footer: metodología, equipo, privacidad, términos y contacto.
- ev-pdf: único generador jsPDF4.2.1 para A4/celular, logo en cabecera y marca de agua en cada página.

## Maquetas previas
Las maquetas de cada tipo (portada, hub, subtema, lector completo/breve, registro/login/recuperar/2FA/cuenta/biblioteca, documentos legales/editoriales,404yagregar) están en las evidencias privadas fuera del repositorio, a390y1440px. El prototipo muestra disposición y jerarquía; los textos bibliográficos proceden del JSON y no se editan.

## Arquitectura y protección
Una presentación: ui/tokens.css + ui/site.css, agrupados en site-runtime.css. UI modular agrupada en site-runtime.js. PDF único cargado a demanda. Nada de style inyectado ni nuevas dependencias de producción.
Fuentes y generadores generan todas las páginas, con SEO existente y URLs invariables. Se retiran capas antiguas y sus cargas. El build añade versión por hash de contenido.
No se cambia resumenes.json, el logo, sitemap/feed/robots ni imágenes sociales. Auth, RLS, secretos y funciones servidor se conservan; las pruebas usan dobles locales.
Presupuestos sin comprimir: CSS≤70KB, JS propio≤90KB. LCP móvil<2,5s; CLS<0,1. Medir con sesión independiente.

## Equivalencia de verificación
Los tests antiguos de navegación, controles, future-experience, lectura unificada y descargas se portan a contratos funcionales ev-. Se conserva cobertura de contenido, búsqueda, filtros, URL, navegación, Auth/Turnstile, versiones, PDFs y AdSense; ningún skip ni umbral más débil. La tabla detallada se completa con las comprobaciones ejecutadas.
Las comprobaciones de integridad clínica no se debilitan. Se retiene article.articulo como único selector de compatibilidad del guard de cuerpo hasta poder mantener lectura de ambas versiones del esquema.

## Criterios obligatorios
Texto renderizado y datos: diferencia cero. 672PDF con título,ID,seccionesylogo. ChromiumyWebKit,390/1440,claroyoscuro. Axe: cero serias/críticas. Sin desborde, foco visible, Esc y movimiento reducido. Presupuestos cumplidos. PR verde, publicación de Pages y recorrido de producción.


## 2026-10-04 — Tarjetas y prosa (T1 / T2)
Las tarjetas empiezan por el título, sin la línea de tipo/año. Estos datos permanecen en la ficha y el filtro. Las insignias de subespecialidad y biblioteca se conservan.
Los párrafos de prosa y listas largas se justifican en todos los anchos, con última línea al inicio, partición automática es-MX y corte de tokens largos. Encabezados, metadatos, controles, navegación, formularios y tablas conservan alineación al inicio. Los textos breves ocupan una última línea sin estirarse.
En PDF, únicamente los párrafos P del cuerpo completo/breve se justifican; el índice de línea pertenece al párrafo entero aunque cruce páginas. La última línea conserva su posición original. En celular, una línea concreta permanece al inicio si tiene una sola palabra o si justificarla ensancharía el espacio a más de 2,5 veces su ancho natural. No se añaden guiones ni se modifica la secuencia de palabras. Logo, marca de agua, márgenes, saneado, carga diferida y jsPDF 4.2.1/SRI conservan su contrato.


### T2-MOBILE — cortes visuales de prosa
Los párrafos mantienen justify e hyphens:auto. ui/core.js ofrece cortes visuales conservadores entre sílabas y wbr en tokens técnicos largos; ui/reader.js los aplica al lector dinámico. Los marcadores son vacíos: el guion opcional se dibuja con CSS y aria-hidden. textContent, selección, HTML clínico de origen y PDF permanecen intactos. La última línea conserva start. Es un apoyo a los diccionarios nativos (WebKit Windows no incluye partición española efectiva); sin JavaScript se conserva la propiedad nativa y el contenido prerenderizado.
