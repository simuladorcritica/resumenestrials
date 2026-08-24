# Automatización local de `resumenes.json`

## Alcance

Esta automatización vigila únicamente el archivo `resumenes.json` situado en la raíz de este repositorio. No observa otras carpetas ni reacciona a cambios en otros archivos.

Cuando el SHA-256 cambia, el proceso:

1. espera tres lecturas estables consecutivas para no leer una escritura parcial de OneDrive;
2. descarga la referencia actual de `origin/main` y obtiene `resumenes.json` directamente desde ese commit;
3. valida que ambos documentos sean JSON y que la raíz sea un arreglo;
4. bloquea IDs o DOI duplicados después de normalizarlos;
5. identifica artículos por ID, después por DOI normalizado y finalmente por título normalizado;
6. bloquea eliminaciones, colisiones de identidad y cualquier cambio semántico en un artículo que ya existe en `main`;
7. ignora diferencias de sangría, saltos de línea, orden de claves y orden del arreglo;
8. termina sin crear Git cuando no hay artículos nuevos;
9. si solo hay altas nuevas, prepara un worktree temporal desde `origin/main`, copia exclusivamente `resumenes.json`, valida el staging, crea una rama `auto/resumenes-json-*`, hace push y abre un PR;
10. deja el merge completamente en manos de una revisión posterior.

La automatización nunca ejecuta `git merge`, nunca hace push a `main` y nunca incluye otro archivo en su commit.

## Requisitos de Windows

- Node.js 20 o posterior disponible como `node`.
- Git disponible como `git` y con `user.name` y `user.email` configurados.
- GitHub CLI disponible como `gh` y autenticado mediante `gh auth login`.
- El remote `origin` debe ser exactamente `simuladorcritica/resumenestrials`, por HTTPS o SSH.

No se guardan tokens ni credenciales en archivos del proyecto. Git y GitHub CLI utilizan sus almacenes de credenciales habituales y la automatización no imprime su salida de autenticación.

## Prueba manual sin crear ramas ni PR

Desde la raíz del repositorio:

```powershell
node scripts/resumenes-json-automation.mjs --repo . --file .\resumenes.json --dry-run
```

El modo `--dry-run` sí consulta `main` y genera un reporte, pero termina antes de comprobar GitHub CLI, crear el worktree, hacer commit, push o abrir el PR.

## Ejecución interactiva del watcher

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\watch-resumenes-json.ps1
```

En el primer arranque se guarda el SHA-256 actual como línea base y no se procesa el archivo. Esto evita que instalar el watcher publique cambios locales preexistentes. Para solicitar explícitamente que el primer arranque procese el estado actual:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\watch-resumenes-json.ps1 -ProcessCurrent
```

## Inicio automático de sesión

La tarea programada es opcional y solo se registra al ejecutar expresamente:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-resumenes-json-watcher.ps1
```

El instalador comprueba `node`, `git` y la sesión de GitHub CLI. Registra una tarea limitada al usuario actual y no inicia el watcher durante la instalación. Se activará en el siguiente inicio de sesión.

Para retirarla:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-resumenes-json-watcher.ps1 -Uninstall
```

## OneDrive, exclusión mutua y reintentos

El watcher combina eventos filtrados por el nombre exacto `resumenes.json` con una comprobación periódica del SHA-256 del mismo archivo. Así puede detectar reemplazos atómicos o eventos que OneDrive no entregue, sin inspeccionar otros archivos.

Antes de ejecutar exige varias muestras idénticas de tamaño, fecha de modificación y SHA-256. Un mutex por ruta impide dos watchers simultáneos, un bloqueo adicional impide dos publicaciones simultáneas y el debounce agrupa ráfagas de eventos de OneDrive.

## Reportes y estado local

Los reportes y el último SHA-256 procesado se guardan fuera de OneDrive y fuera del repositorio:

```text
%LOCALAPPDATA%\ResumenesTrials\resumenes-json-automation\
```

Un bloqueo de seguridad termina con código `2` y produce un reporte sin copiar el contenido médico completo. Los errores transitorios terminan con código `1` y el watcher espera antes de volver a intentarlo.

## Condiciones que bloquean una subida

- JSON inválido o raíz distinta de un arreglo.
- ID duplicado.
- DOI duplicado después de retirar prefijos `doi:` o `https://doi.org/`, normalizar mayúsculas y espacios.
- Eliminación de un artículo presente en `main`.
- Cambio semántico de cualquier campo de un artículo existente.
- Identidad ambigua o colisión entre ID, DOI y título.
- Cambios locales en archivos distintos de `resumenes.json`.
- `origin` inesperado, GitHub CLI ausente o no autenticado, o identidad Git sin configurar.
- Cambio de `main` o del archivo local durante la ejecución.
- Intento de incluir más de `resumenes.json` en el commit.
