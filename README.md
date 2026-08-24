# Resúmenes Trials

Sitio estático de lectura crítica de ensayos clínicos. La rama `main` de este repositorio es la única fuente de verdad del sitio publicado en `https://resumenestrials.com`.

## Fuente editorial protegida

`resumenes.json` contiene el contenido clínico. Los generadores pueden escapar marcado, crear rutas, páginas, metadatos e imágenes, pero no deben reescribir cifras, interpretaciones ni conclusiones. Véase `CONTENT_POLICY.md`.

## Flujo de trabajo

1. Crear una rama desde `main`.
2. Editar la fuente mínima necesaria.
3. Ejecutar `node scripts/normalize-technical-markup.mjs resumenes.json` si existe marcado matemático nuevo.
4. Ejecutar los generadores en el orden documentado en `docs/ARCHITECTURE.md`.
5. Ejecutar validadores y pruebas de navegador.
6. Abrir un pull request; no publicar directamente desde copias locales antiguas.

## Validación local

```text
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm run build
pnpm run validate
```

Con el sitio servido en `http://127.0.0.1:8000`, ejecutar `pnpm run test:browser`. Las versiones de Playwright y jsPDF están fijadas en `package.json` y `pnpm-lock.yaml`.

Las pruebas positivas de registro, login y recuperación son locales y aisladas: interceptan Supabase y usan únicamente las credenciales públicas oficiales de prueba de Turnstile. No crean usuarios, envían correos ni acceden a datos reales. En Windows sin `pdftotext`, `RT_PYTHON_BIN` puede apuntar a un Python con `pypdf` para validar el texto de los PDF.

## Automatización local de `resumenes.json`

Windows puede vigilar exclusivamente el `resumenes.json` local, esperar a que OneDrive termine de escribirlo y abrir un PR solo cuando detecta altas nuevas seguras. El proceso compara contra el `main` remoto, bloquea eliminaciones, duplicados y cambios a artículos existentes, y nunca escribe ni fusiona directamente en `main`.

La instalación, requisitos, estados y reportes están documentados en [`docs/RESUMENES_JSON_AUTOMATION.md`](docs/RESUMENES_JSON_AUTOMATION.md). La tarea programada no se instala automáticamente al clonar o actualizar el repositorio.

## Recuperación

Antes de una estabilización amplia se debe guardar el SHA de `main` en una rama `recovery/*` o tag protegido y crear un bundle Git verificable. Nunca deben almacenarse secretos en el repositorio.
