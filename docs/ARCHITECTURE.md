# Arquitectura

## Fuente y salidas

- `resumenes.json`: fuente clínica canónica.
- `_includes/index-source.html`: portada prerenderizada usada por Jekyll.
- `trials/*/index.html`: páginas canónicas indexables.
- `resumen/*.html`: compatibilidad social/legada, `noindex` y canonical al trial.
- `seo-manifest.json`, `seo-cluster-manifest.json`, `sitemap.xml`: salidas SEO.
- `images/trials/*`: imágenes sociales generadas.
- `site-runtime.js` y `site-runtime.css`: bundles generados; sus fuentes permanecen separadas para mantenimiento.

## Generación reproducible

```text
python generar_seo.py
python generar_seo_semantico.py
python generar_seo_avanzado.py
python restaurar_arquitectura.py
python actualizar_agregar_editorial.py
python generar_paginas_sociales.py
node scripts/build-site-runtime.mjs
python aplicar_experiencia_futura.py
```

Los archivos generados se versionan para que GitHub Pages pueda servirlos sin una plataforma de construcción adicional. Los cambios manuales en salidas generadas serán sobrescritos.

La secuencia debe ser idempotente: dos ejecuciones consecutivas tienen que producir las mismas salidas. `sitemap.xml` solo publica `lastmod` cuando existe una fecha editorial explícita (`fecha_revision`, `actualizado` o `fecha_publicacion_resumen`); la fecha de publicación del estudio no representa una modificación del sitio.

## Servicios

- GitHub Pages: alojamiento y dominio personalizado mediante `CNAME`.
- Supabase: Auth, perfiles, MFA y Edge Functions.
- Cloudflare Turnstile: protección anti-bot; el secreto vive en GitHub/Supabase.
- Resend: avisos de nuevos resúmenes.
- Google AdSense: publicidad declarada en el aviso de privacidad.

Las dos Edge Functions usan imports npm fijados y se resuelven con Deno 2 mediante `deno.json` y `deno.lock`. La prueba positiva de Auth en pull requests sustituye Supabase por un doble local y bloquea cualquier tráfico al proyecto real.

## Secretos requeridos

`SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY` y `RESEND_API_KEY`. Nunca se incorporan a JavaScript público ni al historial Git, y solo se inyectan en pasos de workflow que no se ejecutan para `pull_request`.
