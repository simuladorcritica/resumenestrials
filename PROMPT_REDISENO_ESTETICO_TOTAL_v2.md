# Prompt maestro — Rediseño estético total de Resúmenes Trials v2

Actúa como director de diseño digital, UX/UI senior y frontend engineer especializado en publicaciones científicas, medicina basada en evidencia y productos editoriales premium. Rediseña visualmente **Resúmenes Trials** sin alterar su contenido científico, su lógica de autenticación ni la arquitectura funcional ya operativa.

## Objetivo central

La web debe sentirse como una **publicación médica contemporánea de alto nivel**, no como un dashboard SaaS ni como una colección de componentes agregados. Cada elemento nuevo debe integrarse a la arquitectura editorial existente hasta parecer parte del diseño original.

La prioridad es conseguir: jerarquía tipográfica clara, espacio negativo, lectura rápida, sobriedad, continuidad visual entre páginas y microinteracciones discretas.

## Identidad visual innegociable

Conservar exactamente la identidad cromática y tipográfica de la marca:

- Azul tinta: `#12233b`
- Azul secundario: `#38506e`
- Teal: `#1c8a8a`
- Teal profundo: `#0f5f5f`
- Papel: `#f7f6f2`
- Papel secundario: `#efece4`
- Línea: `#ddd8cc`
- Ámbar: `#c8892a`
- Titulares: **Fraunces**
- Texto de lectura: **Newsreader**
- Metadatos, filtros y microinterfaz: **IBM Plex Mono**

Conservar el logotipo RT, la sensación de papel/editorial, los separadores finos y la composición sobria.

## Reglas estrictas de arquitectura visual

1. **No duplicar llamadas a autenticación en la portada.** El bloque grande de onboarding dentro del contenido debe desaparecer. El acceso a cuenta se resuelve únicamente desde la cabecera.
2. En visitante anónimo, **no mostrar dos botones separados “Crear cuenta” y “Entrar”**. Sustituirlos por un único módulo compacto de cuenta integrado en la cabecera, con una jerarquía editorial del tipo “Tu evidencia / Entrar o crear cuenta”.
3. En usuario autenticado, ese mismo módulo se transforma en identidad de sesión y acceso a `cuenta.html`; no se añade un banner nuevo dentro del contenido.
4. No usar grandes tarjetas blancas, sombras flotantes, gradientes decorativos, esquinas excesivamente redondeadas, paneles tipo app, pills innecesarias ni bloques que parezcan injertados.
5. Los estados activos se expresan con color, línea, peso tipográfico o fondo sutil, no con componentes voluminosos.
6. Los controles de especialidad, año, revista y estado deben pertenecer a **una única barra de filtros**, visualmente coherente con el buscador.
7. Guardar, leído/no leído, biblioteca y recomendaciones son funciones secundarias: deben ser visibles pero nunca competir con título, revista, autor, fecha o hallazgo del ensayo.
8. La sección “Para ti” solo aparece cuando existe sesión y preferencias. Debe parecer una selección editorial compacta, separada por líneas, no un carrusel ni tres tarjetas de dashboard.
9. `index.html`, `biblioteca.html`, `cuenta.html`, `login.html`, `registro.html` y `recuperar.html` deben compartir el mismo lenguaje visual.
10. `resumen.html` conserva su lectura editorial; solo se toca si existe una inconsistencia evidente con el sistema general.
11. `agregar.html` es una herramienta interna y puede mantener una densidad funcional mayor, pero debe conservar la paleta y tipografías.

## Portada

- Mantener como núcleo visual: logo, “Evidencia sin ruido.”, manifiesto editorial y métricas.
- Cabecera persistente y mínima: logo a la izquierda; módulo de cuenta y redes a la derecha.
- El módulo de cuenta debe sustituir los botones separados de registro/acceso.
- Eliminar cualquier caja grande dentro del índice que repita “iniciar sesión / crear cuenta”.
- El índice debe comenzar de forma natural después del bloque editorial.
- Integrar filtros de especialidad, año, revista y estado en la misma zona; evitar una segunda fila que parezca añadida después.
- Mantener el buscador alineado y con la misma altura visual de los filtros.

## Cuenta

- Eliminar apariencia de panel administrativo: sin sidebar con gradiente, sin shell flotante, sin sombras y sin tarjeta general redondeada.
- Usar una navegación lateral o superior editorial basada en líneas, texto y estado activo discreto.
- Formularios sobre fondo papel, con campos sobrios, bordes finos y radio pequeño.
- Las secciones Notificaciones, Seguridad y Preferencias se estructuran con divisores y jerarquía tipográfica, no con tarjetas apiladas.
- Mantener intacta toda la funcionalidad actual: actualización de perfil, notificaciones, preferencias, contraseña, 2FA y cierre de sesión.

## Acceso, registro y recuperación

- Deben sentirse como páginas editoriales de la misma publicación.
- Evitar paneles con gradientes, sombras, esquinas grandes y narrativa promocional demasiado dominante.
- La explicación de valor puede permanecer, pero integrada con fondo papel, líneas y tipografía de la marca.
- En login no duplicar el CTA de creación de cuenta: debe existir una sola ruta clara a registro.
- Mantener intactos Supabase Auth y Cloudflare Turnstile.

## Biblioteca

- Debe ser una extensión natural del índice principal.
- Mismos tamaños de títulos, metadatos, separadores y filtros.
- “Quitar de biblioteca” es una acción secundaria de texto, no un botón prominente.

## Responsive y accesibilidad

- Diseñar y verificar escritorio, tablet y móvil.
- Mantener áreas táctiles suficientes sin convertir cada enlace en un gran botón.
- Conservar foco visible, contraste adecuado, `aria-label`, labels asociadas y navegación por teclado.
- En móvil, el módulo de cuenta de cabecera puede abreviarse sin perder la función ni la identidad del usuario.

## Restricciones funcionales

No modificar salvo necesidad estrictamente visual:

- `auth.js`
- configuración de Supabase
- Cloudflare Turnstile
- `resumenes.json`
- datos científicos
- reglas de clasificación editorial
- SEO y metadatos existentes
- lógica de registro, recuperación, 2FA, preferencias o biblioteca

## Pruebas obligatorias antes de publicar

1. Validación de sintaxis JavaScript.
2. Validación de módulos embebidos.
3. Validación de `resumenes.json`.
4. Smoke test de navegador.
5. Comprobación de que no hay errores de consola atribuibles al código propio.
6. Comprobación de navegación y responsive en portada, login, registro, recuperación, cuenta y biblioteca.
7. Verificación de que la portada no contiene CTA duplicados de cuenta.
8. Verificación de que el contenido científico no cambió.

## Criterios de aceptación

El trabajo se considera terminado solo si:

- La portada conserva la identidad original y se percibe más refinada, no más cargada.
- El módulo de cuenta está en la cabecera y reemplaza los botones separados de “Crear cuenta” y “Entrar”.
- No existe un banner de autenticación duplicado dentro del contenido.
- Los filtros parecen parte de un único sistema.
- Cuenta, login y registro dejaron de parecer un dashboard o una landing SaaS.
- Biblioteca y recomendaciones mantienen la misma arquitectura editorial.
- Todas las funciones siguen operativas.
- Las pruebas automáticas terminan en PASS antes de integrar los cambios en `main`.
