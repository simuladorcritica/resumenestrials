# Seguridad

Los problemas de seguridad deben comunicarse de forma privada a `resumenestrials@outlook.com`; no se deben publicar credenciales o datos personales en issues.

## Controles versionados

- RLS y privilegios de columna en `supabase/schema.sql` y `supabase/migrations/`.
- Turnstile obligatorio en registro, login y recuperación.
- Dependencias externas inventariadas y fijadas en `dependencies.json`.
- SRI y `crossorigin="anonymous"` en todas las cargas de jsPDF desde CDN.
- Dependabot semanal para npm y GitHub Actions, más auditoría de dependencias en estabilizaciones.
- Los workflows de pull request no reciben secretos de producción; Turnstile usa solo sus credenciales oficiales de prueba en CI local aislado.
- HTML clínico restringido a `h2`, `p`, `strong` y `em`, sin atributos.
- URLs originales limitadas a HTTPS.

La configuración efectiva del panel de Supabase, Resend, DNS y Cloudflare debe revisarse después de cada despliegue; el repositorio no puede demostrar por sí solo el estado de esos paneles. `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY` y `RESEND_API_KEY` nunca deben aparecer en código, artefactos ni logs.
