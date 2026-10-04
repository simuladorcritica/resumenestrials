# Verificación de la interfaz

Ejecutar `npm run build`, la secuencia de `ARCHITECTURE.md`, `npm run validate`, `npm run test:resumenes-automation` y `npm run test:browser`. Servir el checkout en loopback y definir `RT_BASE_URL`; instalar Chromium y WebKit. Los tests de Auth bloquean el servicio real y usan dobles locales y la sitekey pública oficial de Turnstile. Nunca ejecutar `auth-production-smoke.mjs` como QA del diseño: modifica cuentas reales.

`scripts/design-browser-suites.mjs` comparte las pruebas funcionales entre las entradas históricas. Cubre ocho combinaciones: Chromium/WebKit × 390/1440 × claro/oscuro. `sweep` recorre las 504 vistas canónica/query completa/query breve en cada combinación. `shell` aplica axe a todas las familias de páginas y colecciones, con reglas WCAG 2.2 AA y cero infracciones serias/críticas.

## Equivalencias

| Entrada anterior | Verificación actual | Contratos conservados |
|---|---|---|
| navigation-ux-smoke | navigation | Cabecera, destinos, búsqueda, atajos, teclado, tema, menú móvil |
| browser-smoke | sweep | Todos los IDs, ambas versiones, título, contenido, controles, overflow y errores |
| home-controls-smoke / library-filter-smoke / future-final-smoke | archive | Todos los filtros, pertenencia, orden, chips, paginación explícita, recarga e historial |
| future-experience-smoke | shell | Todas las superficies, formularios, privacidad/publicidad, estilos y accesibilidad |
| unified-reader-v4-smoke / reader-controls-v5-smoke | reader | Cuerpo íntegro, variantes, secciones, progreso, foco, tamaño, guardado, continuidad y retorno |
| editorial-reader-smoke | Matriz de lectura en 12 tamaños y ambos motores/temas | Títulos largos, overflow, alineación izquierda, ancho legible, navegación activa y ausencia de recorte |
| download-contract-smoke | downloads | Descarga física, seis rutas, nombres, contenido PDF y logo |
| full-site-audit | Crawl estático original + shell | Recursos, enlaces, IDs, spam, captcha, biblioteca, preferencias, MFA, avisos y datos de perfil |
| validate-editorial / validate-resumen-page / validate-night-audit | Validadores portados | Biblioteca, Auth, MFA, preferencias, PDF/SRI, fechas, cuerpos, workflow nocturno y estados |
| Comprobaciones Python de workflows | validate-design.py | Prerender de todos los trials, canonicals, imágenes/JSON-LD, taxonomía, exclusiones y generación consistente |
| reader-runtime-contract | Contrato de ui/reader.js y CSS | Controles presentes, tamaño táctil y rechazo de runtimes incompletos/obsoletos |
| future/unified-reader/reader-buttons production smokes | design-production-smoke | Espera del hash desplegado, clic físico, versiones, secciones, foco, retorno, descarga y errores |
| Auditorías PDF nocturnas/profundas | Herramientas portadas a data-ev-* | Descarga real y extracción con pdftotext/pypdf |
| adsense-routes / adsense-content | Matrices de ambos motores/temas | Peticiones reales; exclusiones antes/después de redirects; gate de datos e IDs inválidos |
| auth-safe-smoke | 40 recorridos positivos | Registro, login correo/usuario, recuperación y contraseña; transmisión de captcha |
| reading-context.test | API existente + nuevo lector | Origen, caducidad, seguridad de URL, query, recarga y retorno |
| Freeze, ingestión, automatización, seguridad, newsletter y GSC | Suites existentes | Conservadas; ninguna prueba de envío real se dispara |

Las aserciones de ornamentación, fuentes y paleta antiguas se sustituyen por los tokens nuevos. El ancho de lectura se comprueba en caracteres (máximo 75ch), en lugar de los 741 px asociados a la fuente anterior; se conservan legibilidad y ausencia de recorte. El grid y sus separaciones siguen los breakpoints del nuevo sistema. Los nombres históricos de tests/workflows permanecen por compatibilidad.

`account-safe-smoke` añade recorridos de perfil, avisos, preferencias, MFA y biblioteca con persistencia local, recomendaciones y axe con sesión. `design-usability-smoke` mide acciones de navegación y consentimiento/envío: escribir y desplazarse no suman una navegación. El acceso rápido Crítica/año evita abrir dos selectores. Las ocho tareas deben requerir tres pulsaciones como máximo; Metodología, dos. También se comprueba la posición de retorno y los filtros.

Los artefactos detallados se entregan fuera del repositorio. Los outputs de CI se guardan como artifacts; no se añaden PDFs, capturas, prompts, datos privados ni informes al sitio público.

Los smokes con AdSense real conservan los errores y registran la pila de creación de las promesas en el contexto de QA. Una excepción se atribuye al proveedor solo cuando su pila señala el script de anuncios de Google y no contiene el origen del sitio, y coincide con un error observado. Toda excepción propia o sin atribución bloquea la prueba. La instrumentación vive únicamente en Playwright y no cambia el código publicado ni suprime eventos. El smoke también conserva las pilas de excepciones directas. Solo atribuye int64 de rum_fy2021.js cuando cada frame tiene una ubicación HTTPS en el host exacto pagead2.googlesyndication.com y ese mismo script. Las pilas vacías, mixtas, nativas, desconocidas, otros mensajes/scripts o hosts parecidos siguen bloqueando; production-error-attribution.test.mjs verifica 13 casos y se ejecuta en validate. La atribución deriva del fallo documentado del job de producción 111546277574, sin retirar controles funcionales.

El barrido de contenido conserva una página durante cada lote de 24 ensayos, con tres rutas por ensayo. Se comprueban las mismas 4032 vistas y todos los errores; al terminar el lote se cierra el navegador completo. Los recorridos de historial y retorno permanecen en reader/archive/usability.

Cada lote de 24 ensayos del barrido exhaustivo usa un navegador nuevo: mantiene las tres rutas por ensayo, los 504 casos por configuración, errores y aserciones, y limita la acumulación de recursos nativos en el runner Linux. No hay reintentos ni excepciones ignoradas.

El health check de main espera que Pages sirva el hash solicitado del bundle y los bytes clínicos del checkout antes de evaluar sus contratos, para evitar comparar un despliegue todavía pendiente con el código nuevo. La espera es limitada; si no llega, falla.

El barrido de CI se distribuye en ocho jobs, uno por motor/ancho/tema. Chromium usa la imagen oficial mcr.microsoft.com/playwright:v1.62.1-noble y WebKit usa windows-latest, ambos con la versión 1.62.1 de package.json. RT_SWEEP_CASE acepta únicamente las ocho configuraciones definidas; sin esta variable, npm run test:browser sigue recorriendo las ocho. Cada job exige 504 vistas: el total sigue siendo 4032, con los mismos límites de espera, aserciones y cero reintentos. Auth/cuenta/usabilidad/geometría se ejecutan en un job separado que exige las ocho configuraciones. Esto aísla el entorno tras errores internos nativos de WebKit en el runner Linux; DEBUG=pw:browser conserva su diagnóstico, sin ignorar errores. Referencia del entorno oficial: https://playwright.dev/docs/ci.

El diagnóstico del job Linux mostró un aborto nativo malloc_consolidate(): unaligned fastbin chunk detected antes del fallo de navegación. Se conserva una única WebView durante cada lote de 24 ensayos y se reinicia el navegador completo entre lotes. Esto evita destruir/recrear la WebView por ensayo y limita el historial acumulado; es una hipótesis de aislamiento del fallo nativo, no un diagnóstico de fuga de memoria. Todas las rutas y pageerror se verifican con las mismas aserciones; no se filtra ningún fallo nativo ni propio.

La matriz Linux completó siete configuraciones, pero WebKit390oscuro abortó en el asignador nativo incluso con una WebView por lote. Por ello las cuatro configuraciones exhaustivas de WebKit se verifican en Windows, plataforma oficialmente soportada y utilizada también en la verificación local y de producción. No cambia la versión del motor ni se elimina una ruta, aserción, pageerror o límite de espera. Las suites de interacción y el resto de controles conservan Linux y sus dos motores. El fallo del port Linux queda documentado como limitación del entorno; no se afirma haber corregido WebKit.

El contrato de aislamiento de Resend QA comprueba explícitamente los tres jobs de navegador nuevos, además de datos, PDF y salud de producción. El servidor Windows se inicia con el ejecutable Python configurado y permanece dentro del mismo paso que el barrido; se exige HTTP200 antes de probar y se cierra en finally.

El comando test:browser ejecuta una vez cada grupo funcional. home-controls-smoke cubre archive; library-filter-smoke y future-final-smoke son aliases del mismo runSuite(archive) y permanecen como entradas de compatibilidad para workflows. full-site-audit conserva el crawl y runSuite(shell); future-experience-smoke sigue siendo su alias de shell para workflows. Así se conservan todos los controles y sus ocho configuraciones, eliminando únicamente invocaciones idénticas repetidas. El retorno del lector espera DOMContentLoaded más la URL y contador/filtros/vista/geometry del archivo; Guardar exige la URL next y formulario de login visible. No se retira una aserción funcional ni se amplía el límite de 15 segundos.
