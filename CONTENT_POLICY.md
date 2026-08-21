# Política de integridad clínica

## Cambios automáticos permitidos

- Escapar caracteres HTML sin cambiar el texto visible, por ejemplo `<` a `&lt;`.
- Sanitizar etiquetas y atributos no permitidos.
- Corregir rutas, canonical, Open Graph, JSON-LD, sitemap y presentación.
- Regenerar páginas derivadas a partir de `resumenes.json`.

## Cambios que requieren revisión humana

- Añadir, retirar o reordenar afirmaciones médicas.
- Cambiar cifras, denominadores, medidas de efecto, intervalos o valores P.
- Modificar conclusiones, riesgo de sesgo, aplicabilidad o seguridad.
- Completar secciones clínicas ausentes o alterar la extensión por objetivos editoriales.

Los validadores deben distinguir errores técnicos, que bloquean CI, de avisos editoriales, que no autorizan una reescritura automática.
