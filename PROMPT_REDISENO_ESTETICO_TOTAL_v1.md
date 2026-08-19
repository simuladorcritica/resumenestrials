# Prompt maestro — Rediseño estético total de Resúmenes Trials

Actúa como director de diseño digital, UX/UI senior y frontend engineer especializado en publicaciones científicas y productos médicos premium. Rediseña visualmente Resúmenes Trials sin alterar su identidad editorial, su información científica ni sus flujos funcionales.

## Objetivo
Conseguir una interfaz editorial médica premium, sobria, limpia, coherente y reconocible. Debe sentirse como una publicación científica contemporánea, no como un dashboard SaaS. Toda función nueva debe integrarse a la arquitectura visual existente y no parecer un bloque añadido posteriormente.

## Identidad que debe conservarse
- Paleta: azul tinta #12233b, azul secundario #38506e, teal #1c8a8a, teal profundo #0f5f5f, papel #f7f6f2, papel secundario #efece4, línea #ddd8cc y ámbar #c8892a.
- Tipografía editorial: Fraunces para titulares, Newsreader para lectura y IBM Plex Mono para metadatos, filtros y microinterfaz.
- Logo RT y estética de papel/editorial.
- Separadores finos, mucho espacio negativo, jerarquía tipográfica y ausencia de sombras o gradientes decorativos innecesarios.

## Reglas estrictas
1. No duplicar acciones. En usuarios anónimos, Crear cuenta y Entrar existen exclusivamente en la cabecera. No crear un segundo bloque de registro/inicio de sesión dentro del contenido.
2. En usuarios autenticados, sustituir Crear cuenta + Entrar en la cabecera por un único control discreto de cuenta/usuario que lleve a cuenta.html. La biblioteca debe estar accesible desde ese contexto sin crear un banner promocional.
3. No introducir tarjetas grandes, pills excesivas, bordes redondeados de estilo app ni gradientes que contradigan la arquitectura editorial.
4. Los filtros avanzados deben pertenecer visualmente a la misma barra del índice: especialidad, año, revista y estado. Deben mantener proporciones, tipografía, bordes y espaciado coherentes.
5. Guardar, leído/no leído y recomendaciones deben ser microinteracciones editoriales discretas. No competir con título, revista, autor o resultado del ensayo.
6. La sección Para ti solo aparece para usuarios autenticados con preferencias. Debe parecer una selección editorial compacta, no tres tarjetas de dashboard.
7. Mi biblioteca y Cuenta deben compartir exactamente el mismo sistema visual de portada: paleta, escala tipográfica, espaciado, botones, campos y cabecera.
8. Mantener responsive real para escritorio, tablet y móvil. No sacrificar legibilidad ni controles táctiles.
9. Accesibilidad: foco visible, contraste suficiente, labels/aria y navegación por teclado.
10. No modificar auth.js, Supabase, Turnstile, datos científicos, resumenes.json ni lógica editorial salvo lo estrictamente necesario para presentar la UI.

## Portada
- Conservar hero, manifiesto editorial y métricas como núcleo visual.
- Cabecera mínima: logo a la izquierda; cuenta/sesión y redes a la derecha.
- El índice debe comenzar directamente después del bloque editorial y respirar suficientemente.
- Integrar todos los filtros en un único sistema visual. El buscador permanece alineado con ellos.
- Evitar banners de onboarding dentro del índice.
- Para usuario autenticado, añadir solo información contextual útil y discreta: cuenta, biblioteca, no leídos y recomendaciones.

## Biblioteca
- Convertirla en una extensión natural del índice editorial.
- Títulos y metadatos con la misma jerarquía de la portada.
- Quitar guardado mediante acción secundaria discreta.
- Búsqueda y filtros con el mismo componente visual que la portada.

## Cuenta
- Mantener navegación clara, pero reducir sensación de panel administrativo.
- Preferir composición editorial, separadores, subtítulos y formularios sobrios.
- Preservar seguridad y todas las funciones actuales.

## Criterios de aceptación
- No hay CTA duplicados de Crear cuenta/Entrar.
- No hay bloques visuales que parezcan injertados.
- Paleta y tipografías son consistentes en portada, biblioteca y cuenta.
- Las funciones interactivas siguen operativas.
- Sin errores de consola atribuibles al código propio.
- resumenes.json y contenido editorial intactos.
- Health checks, validación JS/datos y smoke test de navegador deben terminar en PASS antes de publicar/cerrar el trabajo.
