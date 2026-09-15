# Protección de `main`

Este repositorio usa `main` como rama de producción. Los cambios humanos deben entrar mediante pull request y validación automática antes de fusionarse.

## Ruleset recomendado

Crear un **Branch ruleset** activo dirigido únicamente a la rama predeterminada (`main`).

Reglas:

- Requerir pull request antes de fusionar.
- Requerir resolución de conversaciones.
- Requerir que los status checks obligatorios pasen.
- Requerir que la rama del PR esté actualizada con `main` antes del merge.
- Bloquear force pushes.
- Bloquear la eliminación de `main`.
- No exigir historial lineal mientras se utilicen merge commits.
- No exigir commits firmados mientras existan automatizaciones que producen commits no firmados.

## Status checks obligatorios

Los checks estables que deben configurarse como requeridos son:

- `data-validation`
- `browser-smoke`
- `download-contract-smoke`
- `audit`
- `future-experience`

## Bypass técnico

Las automatizaciones existentes de GitHub Actions regeneran salidas derivadas y persisten algunos estados operativos después de cambios aprobados. Para no romper ese flujo, el único bypass técnico permitido debe ser la integración **GitHub Actions** (`github-actions`, app id `15368`).

No debe existir bypass humano permanente.

## Aprobación editorial

El repositorio tiene un único propietario/editor. Por ello, el ruleset no debe exigir una aprobación externa imposible de satisfacer. La autorización editorial sigue siendo explícita y previa al merge, y las verificaciones automáticas no sustituyen esa autorización.

## Criterio de cierre

La protección se considera operativa cuando:

1. GitHub muestra un ruleset activo aplicable a `main`.
2. Un push humano directo a `main` queda bloqueado.
3. Un PR no puede fusionarse mientras alguno de los cinco checks obligatorios esté pendiente o fallando.
4. GitHub Actions conserva únicamente el bypass técnico necesario para sus automatizaciones.
5. Los merges humanos continúan realizándose por PR con autorización editorial explícita.

Seguimiento administrativo: issue #95.
