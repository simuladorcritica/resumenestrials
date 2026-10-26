# Guía para Claude en este repositorio

Sitio estático de GitHub Pages (resumenestrials.com) con resúmenes críticos de ensayos clínicos en Medicina Crítica y Medicina Interna. El editor trabaja en español: responde, comenta y describe los PR en español.

## Reglas que no se negocian

- No modificar `resumenes.json` ni el texto clínico de ningún resumen, salvo que el editor lo pida expresamente para ese cambio.
- No editar a mano salidas generadas (`site-runtime.js`, `site-runtime.css`, `trials/`, `resumen/`, `index.html`, sitemap, manifests): se cambian sus fuentes y se regeneran.
- No imprimir, versionar ni pegar secretos o tokens.
- No crear usuarios reales, enviar correos ni publicar en Telegram/X. No lanzar `notificar-nuevos-resumenes` ni `resend-qa-single-recipient`.
- No debilitar, saltar ni borrar pruebas para que pasen.
- No versionar prompts ni reportes internos.

## Flujo de trabajo

1. Crea una rama `claude/<tema>` desde `main`. `main` está protegida: todo entra por PR con los cinco checks obligatorios (`data-validation`, `browser-smoke`, `download-contract-smoke`, `audit`, `future-experience`).
2. Cambia solo las fuentes: `ui/` (tokens, estilos y módulos), `site_templates.py`, `templates/` y los scripts generadores. Arquitectura en `docs/ARCHITECTURE.md`; diseño en `docs/DESIGN_SYSTEM.md`.
3. Instala dependencias si hace falta: `pnpm install --frozen-lockfile` y `python3 -m pip install pillow==11.3.0`.
4. Regenera las salidas con la misma secuencia que usa CI y confirma que una segunda ejecución no produce cambios:

   ```bash
   node scripts/build-site-runtime.mjs
   python3 generar_seo.py
   python3 generar_seo_semantico.py
   python3 generar_seo_avanzado.py
   python3 restaurar_arquitectura.py
   python3 actualizar_agregar_editorial.py
   python3 generar_paginas_sociales.py
   python3 aplicar_experiencia_futura.py
   ```

   Incluye todas las salidas regeneradas en el mismo commit. Si faltan, el workflow `actualizar-sitemap` añade un commit automático a la rama y los checks obligatorios no se ejecutan sobre ese commit, con lo que el PR queda bloqueado.
5. Ejecuta `npm run validate` y las suites de navegador afectadas (`docs/TESTING.md`). Comprueba claro y oscuro, 390 px y 1440 px.
6. Haz push y abre el PR hacia `main` con un resumen breve en español: qué cambia, cómo se verificó y que el contenido clínico no se tocó.

El editor solo pulsa «Enable auto-merge» en el PR: GitHub lo fusiona cuando pasan los cinco checks y la rama se borra sola. Si un check falla, corrígelo en la misma rama.
