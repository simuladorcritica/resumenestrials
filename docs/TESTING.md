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

Los smokes con AdSense real conservan los errores y registran la pila de creación de las promesas en el contexto de QA. Una excepción se atribuye al proveedor solo cuando su pila señala el script de anuncios de Google y no contiene el origen del sitio, y coincide con un error observado. Toda excepción propia o sin atribución bloquea la prueba. La instrumentación vive únicamente en Playwright y no cambia el código publicado ni suprime eventos.

El barrido de contenido abre una página aislada por ensayo y conserva dentro de ella las tres rutas. Se comprueban las mismas 4032 vistas y todos los errores de cada página; se libera documento/historial entre ensayos independientes para evitar acumular cientos de navegaciones en WebKit. Los recorridos de historial y retorno permanecen en reader/archive/usability.
