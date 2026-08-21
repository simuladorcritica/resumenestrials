# Seguridad

Los problemas de seguridad deben comunicarse de forma privada a `resumenestrials@outlook.com`; no se deben publicar credenciales o datos personales en issues.

## Controles versionados

- RLS y privilegios de columna en `supabase/schema.sql` y `supabase/migrations/`.
- Turnstile obligatorio en registro, login y recuperación.
- Dependencias externas inventariadas y fijadas en `dependencies.json`.
- HTML clínico restringido a `h2`, `p`, `strong` y `em`, sin atributos.
- URLs originales limitadas a HTTPS.

La configuración efectiva del panel de Supabase, DNS y Cloudflare debe revisarse después de cada despliegue; el repositorio no puede demostrar por sí solo el estado de esos paneles.
