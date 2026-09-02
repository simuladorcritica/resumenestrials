# Baseline SEO — 2026-09-02

Medición local realizada antes de esta implementación sobre `7456222` (`fix/specialty-classification`). La producción se comprobó por HTTP el mismo día.

| Métrica | Antes | Después local |
|---|---:|---:|
| Resúmenes | 113 | 113 |
| URLs canónicas de trials | 113 | 113 |
| URLs indexables medidas | 131 | 132 |
| URLs en sitemap | 131 | 132 |
| Canonicals duplicados | 0 | 0 |
| Noindex dentro del conjunto canónico | 0 | 0 |
| Páginas huérfanas | no existía medición bloqueante | 0 |
| Títulos duplicados | no existía medición bloqueante | 0 |
| Descripciones duplicadas | no existía medición bloqueante | 0 |
| H1 duplicados | no existía medición bloqueante | 0 |
| Enlaces internos rotos detectados | 6 referencias tratadas erróneamente como URL | 0 |
| JSON-LD válido medido | 131 | 132 |
| Errores del validador de datos | 11 falsos P1 por fechas bibliográficas humanas | 0 |
| Feed | ausente (404 en producción) | Atom generado y validado localmente |

La URL indexable adicional corresponde al hub de Hematología y oncología habilitado por la clasificación clínica ya presente en el commit base. El cambio SEO solo materializa la salida derivada.

## Producción antes del despliegue

- Portada, trial SOHO, hub cardiovascular y hub sepsis-shock: HTTP 200, title, description, canonical y JSON-LD presentes.
- `robots.txt`: HTTP 200 y sitemap declarado.
- `sitemap.xml`: HTTP 200.
- `feed.xml`: HTTP 404, corrección preparada en esta rama.

Core Web Vitals de campo y métricas de Search Console no están disponibles sin acceso a las propiedades privadas. No se inventan valores.
