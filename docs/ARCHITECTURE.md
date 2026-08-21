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

## Servicios

- GitHub Pages: alojamiento y dominio personalizado mediante `CNAME`.
- Supabase: Auth, perfiles, MFA y Edge Functions.
- Cloudflare Turnstile: protección anti-bot; el secreto vive en GitHub/Supabase.
- Resend: avisos de nuevos resúmenes.
- Google AdSense: publicidad declarada en el aviso de privacidad.

## Secretos requeridos

`SUPABASE_ACCESS_TOKEN`, `TURNSTILE_SECRET_KEY` y `RESEND_API_KEY`. Nunca se incorporan a JavaScript público ni al historial Git.
