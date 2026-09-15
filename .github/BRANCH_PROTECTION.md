# Protección de `main`

Este repositorio usa `main` como rama de producción. Los cambios humanos y las salidas derivadas que deban persistirse deben entrar mediante pull request y validación automática antes de fusionarse.

## Ruleset recomendado

Crear un **Branch ruleset** activo dirigido únicamente a la rama predeterminada (`main`).

Reglas:

- Requerir pull request antes de fusionar.
- Requerir resolución de conversaciones.
- Requerir que los status checks obligatorios pasen.
- Requerir que la rama del PR esté actualizada con `main` antes del merge.
- Bloquear force pushes.
- Bloquear la eliminación de `main`.
- Mantener `Required approvals = 0` mientras exista un único propietario/editor.
- Permitir únicamente merge commits.
- No exigir historial lineal mientras se utilicen merge commits.
- No exigir commits firmados mientras existan automatizaciones que produzcan commits no firmados en ramas de trabajo.

## Status checks obligatorios

Los checks estables que deben configurarse como requeridos son:

- `data-validation`
- `browser-smoke`
- `download-contract-smoke`
- `audit`
- `future-experience`

Siempre que GitHub lo permita, asociar el check con la fuente **GitHub Actions** en lugar de `Any source`.

## Bypass

La lista de bypass debe permanecer **vacía**.

No debe existir bypass humano ni bypass permanente para automatizaciones. Para hacerlo posible:

- las salidas SEO y editoriales derivadas se regeneran y, cuando corresponde, se materializan en la rama del PR antes del merge;
- las ejecuciones sobre `main` verifican que no exista deriva y fallan si detectan salidas pendientes, en lugar de escribir directamente en `main`;
- los estados operativos posteriores al despliegue se guardan como artefactos de GitHub Actions y en el resumen de la ejecución, no como commits automáticos sobre `main`.

## Aprobación editorial

El repositorio tiene un único propietario/editor. Por ello, el ruleset no exige una aprobación externa imposible de satisfacer. La autorización editorial sigue siendo explícita y previa al merge, y las verificaciones automáticas no sustituyen esa autorización.

## Criterio de cierre

La protección se considera operativa cuando:

1. GitHub muestra un ruleset activo aplicable a `main`.
2. Un push directo a `main` queda bloqueado tanto para humanos como para automatizaciones sin PR.
3. Un PR no puede fusionarse mientras alguno de los cinco checks obligatorios esté pendiente o fallando.
4. Las automatizaciones de regeneración persisten sus cambios únicamente en ramas de PR y las comprobaciones posmerge no escriben en `main`.
5. Los estados de producción se conservan mediante artefactos/resúmenes de Actions sin commits automáticos a `main`.
6. Los merges humanos continúan realizándose por PR con autorización editorial explícita.

Seguimiento administrativo: issue #95.
