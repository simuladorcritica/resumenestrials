# Implementación del diseño aprobado

Fecha: 18 de septiembre de 2026. Rama: `rediseno/evidencia-sin-ruido`.
Base local verificada: `ee5d333c2e1d08c34af1dd0e47671f9dffe3e385`.

## Cambios

Portada con el eslogan «Evidencia sin ruido» y el texto aprobado: «Te ayudamos a entender qué aporta cada estudio y qué dudas siguen abiertas». La imagen original sustituye la esfera decorativa; no contiene rótulos Atlas, flechas ni la secuencia Ciencia / Contexto / Criterio. Se conservan los contadores, situados después del catálogo.

Tarjetas con bordes azules, superficies claras/oscuras y títulos Manrope. Lector con títulos Manrope y cuerpo Source Serif 4. Navegación, búsqueda, cuentas, descargas y contenido siguen utilizando sus controladores existentes. Los estilos nuevos están limitados a pantalla para conservar la impresión y los PDF.

Imagen distribuida: `images/evidencia-sin-ruido.jpg`, 1536 × 1024, 238 605 bytes. Procede de la propuesta aprobada y fue creada con el generador integrado. El original y el prompt se conservan fuera del repositorio en `rediseno-etapa-2/atlas-futuro/` del espacio de trabajo.

## Validación

- Compilación del runtime y comprobación de sintaxis correctas.
- Ejecutados todos los pasos de `package.json → validate` mediante Node, porque npm no está disponible en este entorno: datos, editorial, módulos, newsletter, lector, auditoría nocturna, sitemap, feed, SEO, indexabilidad, legal/OAuth y 22 pruebas automatizadas. Sin errores; tres advertencias preexistentes de datos opcionales y formato bibliográfico.
- Auditoría SEO: 168 resúmenes, 188 páginas indexables, cero hallazgos P0/P1/P2. Es comprobación local, no comprobación de producción.
- Navegador: imagen cargada; catálogo con 168 filas; búsqueda PREOXI devuelve el ensayo; apertura del lector completo y cambio al breve correctos. Sin desbordamiento en portada a 320, 390, 736, 1024 y 1440 px; lectores completo y breve revisados en móvil. Temas claro y oscuro inspeccionados.
- `git diff --exit-code HEAD -- resumenes.json trials resumen auth.js trial-pdf.js seo-manifest.json`: sin diferencias. SHA-256 de resumenes.json: `a20a3324685a597d99be4417f6bacae6af5ed2e971ef2dd42fdc720aac1e1806`.

## Límites y publicación

El manifiesto ya consumido del PR #101 se conserva íntegro en `docs/archive/clinical-correction-authorizations-pr101.json`. Sus autorizaciones no se reutilizan. Tanto `verify-clinical-freeze.mjs` como `verify-trial-body-freeze.mjs` pasan contra la base remota `ee5d333c`: 168 artículos protegidos, cero cambios clínicos y cero altas.

En la revisión local no se probaron inicios de sesión reales, guardados privados ni descargas de PDF de extremo a extremo. Sus controladores y datos no fueron modificados. Las comprobaciones de integración del PR complementan esta revisión.

Publicación autorizada por el usuario el 18 de septiembre y continuada el 19. Se verificó que main sigue en `ee5d333c`. El cambio se publica mediante una rama de revisión y PR; la fusión depende de las comprobaciones de GitHub.
