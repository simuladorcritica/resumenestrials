# Arquitectura SEO autónoma

## Fuente y límites editoriales

`resumenes.json` es la única fuente clínica. Los generadores pueden validar, clasificar, escapar HTML y crear páginas, metadatos, enlaces, hubs, sitemap, feed e imágenes, pero no reescriben resultados, cifras, conclusiones, DOI, autores ni interpretación médica. Los datos de Search Console se guardan aparte en `seo-data/` y nunca vuelven a la fuente editorial.

## Canal de publicación

`resumenes.json` → validación clínica/técnica → `generar_seo.py` → trials estáticos → generadores semántico y avanzado → hubs → `sitemap.xml` + `feed.xml` → QA → GitHub Pages.

Cada trial tiene una URL estable `/trials/[slug]/`, canonical autorreferente, HTML inicial completo, metadatos sociales, `Article` y `BreadcrumbList`. Las vistas históricas `/resumen.html?id=…` y `/resumen/*.html` son lectores de compatibilidad y no se publican en el sitemap; apuntan por canonical a la página del trial. GitHub Pages no ofrece redirects HTTP arbitrarios, por lo que un 301 de parámetros requiere una regla externa en Cloudflare. Hasta entonces, canonical/noindex evita competencia sin crear loops.

## Taxonomía, hubs y enlaces

Las áreas cerradas son Medicina Crítica y Medicina Interna. `generar_seo_clusters.py` usa `seo-clusters.json`; solo materializa clusters con al menos tres trials y nunca inventa texto clínico. Cada trial enlaza su área y hasta cuatro artículos relacionados mediante coincidencia de área y temas. `scripts/seo-audit.mjs` bloquea P0/P1 si una página indexable queda huérfana, rompe un enlace, contradice su canonical o falta en el sitemap.

## Sitemap y feed

El sitemap contiene únicamente portada, metodología, equipo editorial, áreas, hubs con contenido y trials canónicos. `lastmod` solo procede de `fecha_revision`, `actualizado` o `fecha_publicacion_resumen`; `fecha` es la fecha bibliográfica del estudio y no se usa como modificación del sitio.

`feed.xml` es Atom, se regenera con el sitio y publica hasta 50 resúmenes con fecha editorial explícita. No inventa una fecha para registros antiguos. Las páginas incluyen discovery mediante `<link rel="alternate">`.

## Search Console y privacidad

El workflow `seo-intelligence.yml` lee la propiedad de dominio `sc-domain:resumenestrials.com` mediante OAuth de usuario con el scope mínimo `https://www.googleapis.com/auth/webmasters.readonly`. El identificador de cliente, el secreto y el refresh token se guardan exclusivamente como GitHub Secrets; nunca se imprimen ni se versionan. La cuenta de servicio anterior sigue disponible como respaldo. Sin credenciales completas, el workflow produce el informe técnico y deja explícito que no hubo métricas privadas. La configuración paso a paso está en `docs/google-search-console-oauth.md`.

La descarga agrega `date`, `query` y `page`, con clicks, impressions, CTR y position. En GitHub Actions, el archivo detallado y todos los reportes derivados permanecen únicamente en `$RUNNER_TEMP/gsc/`, nunca entran en logs, summaries, caches o artefactos, y se eliminan al finalizar el job. Si Resend está disponible, los informes se entregan exclusivamente a la dirección administrativa autorizada; de lo contrario permanecen efímeros. No se recogen datos médicos personales.

## Opportunity Score

`scripts/seo-opportunities.mjs` calcula un valor 0–100 con pesos configurables en `seo-config.json`: impresiones 25%, rango 25%, brecha de CTR 20%, caída 15%, enlaces internos 10% y canibalización 5%. Clasifica A (posición 4–15), B (CTR bajo), C (posición 11–30), E (consulta compartida) y F (caída). El resultado recomienda revisión humana; nunca cambia contenido científico.

Genera `reports/seo-opportunities.json`, `reports/seo-weekly.md` (7d contra 7d) y `reports/seo-monthly.md` (28d contra 28d). Cuando faltan datos, genera un reporte explícito vacío en lugar de simular resultados.

## Automatizaciones y severidad

- `actualizar-sitemap.yml`: regenera todas las salidas derivadas cuando cambia la fuente.
- `site-quality.yml`: valida datos, páginas, schema, canonical, sitemap, feed, enlaces y preservación clínica en PR.
- `revision-nocturna.yml`: revisión editorial/técnica diaria y issue visible.
- `seo-intelligence.yml`: análisis semanal y mensual privado; publica solo estados y conserva como artefacto la auditoría estrictamente técnica.

P0 bloquea por caída, canonical/sitemap masivo o duplicidad canónica. P1 bloquea por página faltante, schema inválido, enlace roto u orfandad. P2 informa duplicados o metadatos mejorables. P3 agrupa microoptimizaciones.

## Operación y troubleshooting

1. Ejecutar los generadores en el orden de `docs/ARCHITECTURE.md`.
2. Ejecutar `node scripts/seo-audit.mjs --output reports/seo-technical.json --fail-on-high`.
3. Ejecutar `node scripts/validate-feed.mjs` y los validadores existentes.
4. Si Search Console devuelve 403, comprobar que la cuenta autorizada tiene acceso a la propiedad exacta y que la Search Console API está habilitada. Si aparece `invalid_grant`, repetir el bootstrap OAuth y sustituir los tres secretos juntos.
5. Si aparece una página huérfana, corregir el generador/hub que debe enlazarla; no añadir un enlace oculto.
6. Si cambia un slug ya publicado, documentar el mapa anterior→nuevo y crear primero un 301 en Cloudflare.

Google Indexing API no se usa para trials. El descubrimiento se basa en enlaces HTML, sitemap, Atom y Search Console.
