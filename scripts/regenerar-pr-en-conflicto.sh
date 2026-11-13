#!/usr/bin/env bash
# Integra main en una rama de PR que solo choca en salidas generadas y las regenera.
# Uso: scripts/regenerar-pr-en-conflicto.sh <rama>   (con origin/main y origin/<rama> ya descargadas)
# Sale con 0 si dejó un commit listo, 2 si no hacía falta, 3 si el conflicto toca fuentes (requiere a una persona)
# y 1 si algo falló (merge que no arranca, generación inestable).
set -euo pipefail
branch="$1"
# Identidad de git: en los runners de GitHub no hay ninguna y `git merge` se niega a empezar («Committer
# identity unknown»), incluso con --no-commit. Ese fallo se tomaba por «sin conflictos» y el flujo
# terminaba en rojo sin integrar nada (corridas programadas del 10 al 13 de noviembre de 2026).
export GIT_AUTHOR_NAME="${GIT_AUTHOR_NAME:-github-actions[bot]}" GIT_COMMITTER_NAME="${GIT_COMMITTER_NAME:-github-actions[bot]}"
export GIT_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"
export GIT_COMMITTER_EMAIL="${GIT_COMMITTER_EMAIL:-$GIT_AUTHOR_EMAIL}"
git checkout -q -B "$branch" "origin/$branch"
if git merge-base --is-ancestor origin/main HEAD; then echo "La rama ya contiene main."; exit 2; fi
if merge_output=$(git merge --no-ff --no-commit origin/main 2>&1); then
  echo "main se integra sin conflictos; se regeneran igualmente las salidas."
elif ! git rev-parse -q --verify MERGE_HEAD >/dev/null; then
  echo "git merge no pudo empezar (no es un conflicto): $merge_output" >&2; exit 1
fi
conflicted=$(git diff --name-only --diff-filter=U || true)
# Fuentes: nunca se resuelven solas. Todo lo demás son salidas que la secuencia de CLAUDE.md reescribe.
sources=$(printf '%s\n' "$conflicted" | grep -E '^(resumenes\.json|clinical-correction-authorizations\.json|ui/(tokens|site)\.css|ui/[^/]+\.js$|templates/|scripts/|tools/|docs/|\.github/|fonts/|vendor/|[^/]+\.py$|package(-lock)?\.json|pnpm-lock\.yaml|CLAUDE\.md|_config\.yml)' || true)
if [ -n "$sources" ]; then
  echo "Conflicto en fuentes; requiere revisión humana:"; printf '  %s\n' $sources
  git merge --abort
  exit 3
fi
if [ -n "$conflicted" ]; then
  # Se toma la versión de main de cada salida en conflicto; la regeneración la reescribe con las fuentes de la rama.
  printf '%s\n' "$conflicted" | xargs -r git checkout --theirs --
  printf '%s\n' "$conflicted" | xargs -r git add --
fi
regen() {
  node scripts/build-site-runtime.mjs
  python3 generar_seo.py
  python3 generar_seo_semantico.py
  python3 generar_seo_avanzado.py
  python3 restaurar_arquitectura.py
  python3 actualizar_agregar_editorial.py
  python3 generar_paginas_sociales.py
  python3 aplicar_experiencia_futura.py
}
regen >/dev/null
git add -A
regen >/dev/null
if ! git diff --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then echo "La segunda regeneración cambió archivos: no es idempotente." >&2; git diff --stat | tail -3 >&2; exit 1; fi
git commit -q -m "Integrar main y regenerar salidas" -m "Sin conflictos en fuentes: las salidas generadas se tomaron de main y se regeneraron con las fuentes de esta rama."
echo "Listo: $(git rev-parse --short HEAD)"
