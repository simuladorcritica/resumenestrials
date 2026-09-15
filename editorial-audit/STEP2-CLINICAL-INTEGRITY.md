# Paso 2 — Integridad clínica y editorial

Fecha de inicio: 2026-09-15

Issue de control: #97

> Este documento registra verificación documental y propuestas editoriales. **No equivale a revisión humana clínica ni a aprobación de los artículos.** Ninguna persona se registra como `clinical_reviewer` mientras no exista una revisión humana real y explícita.

## Inventario

- Inventario actual: 168 resúmenes.
- Rama de trabajo: `editorial/step2-clinical-integrity`.
- `main` permanece protegido; las correcciones clínicas sólo podrán entrar mediante PR, checks obligatorios y autorización expresa.

## Bloque A — discrepancias conocidas

### ID 46 — Doppler de vena renal y titulación de PVC en sepsis

**Fuente primaria:** Huo Y et al. *Critical Care*. 2026;30:86. DOI `10.1186/s13054-026-05842-z`.

**Verificación:**

- El artículo informa progresión de LRA a 7 días de 57% en control frente a 43% en intervención (RR 0,74; IC 95% 0,52–1,06; p=0,132).
- El artículo informa explícitamente un modelo de Cox con HR 1,313 para intervención frente a control (IC 95% 0,773–2,229; p=0,313) y lo interpreta como riesgo ligeramente mayor, no significativo.
- Por tanto, es incorrecto afirmar que el artículo no comenta ese HR.
- La inspección documental previa de la figura 3 identificó la curva de intervención por encima de la curva control, lo que no es congruente de forma evidente con la dirección que el texto atribuye al Cox. La codificación/referencia exacta del modelo no puede reconstruirse con seguridad a partir de lo publicado.
- No debe invertirse el HR ni utilizarse la figura para adjudicar por cuenta propia el grupo de referencia.

**Corrección propuesta:**

Sustituir la afirmación actual de que la figura muestra menor supervivencia libre de LRA en intervención y que el artículo no concilia/menciona el HR por una formulación prudente:

> Existe una discrepancia no resuelta entre la presentación gráfica de la supervivencia libre de LRA y la parametrización que el texto atribuye al modelo de Cox. El artículo informa HR 1,313 (IC 95% 0,773–2,229; p=0,313) para intervención frente a control y lo interpreta como un riesgo ligeramente mayor de LRA, aunque no significativo; sin embargo, la representación gráfica no resulta congruente de forma evidente con esa dirección. Con la información publicada no puede reconstruirse con seguridad la referencia/codificación exacta del modelo. No debe invertirse el HR ni presentarse la curva como confirmación de daño o beneficio; la discrepancia debe considerarse un problema de reporte que requeriría aclaración de los autores.

También debe eliminarse en cálculos derivados/conclusión cualquier frase que atribuya al conjunto «Kaplan–Meier/Cox» una dirección inequívoca si depende de esa lectura gráfica.

**Estado:** `P0 — CORRECCIÓN PROPUESTA / pendiente autorización clínica-editorial`.

### ID 41 — sillón fuera de cama frente a semiincorporado

**Fuente primaria:** Fossat G et al. *Intensive Care Medicine*. 2026;52:1222–1234. DOI `10.1007/s00134-026-08453-y`.

**Verificación:**

- Methods declara realización entre junio de 2020 y agosto de 2024.
- Results declara aleatorización entre 06/2020 y 06/2024.
- Esta diferencia de fechas es una discrepancia documental real; no debe resolverse por inferencia usando la fecha de finalización del registro.
- Las medias marginales 237/226 mmHg y 228/219 mmHg proceden de modelos con ajustes distintos: el análisis principal usa las variables de estratificación; la tabla suplementaria S7 añade ajuste por características basales potencialmente desequilibradas.
- Por tanto, es incorrecto presentarlas como dos estimaciones incompatibles del mismo modelo.

**Corrección propuesta:**

En Resultados, sustituir la acusación de inconsistencia por:

> Conviene distinguir dos estimaciones procedentes de modelos distintos: el análisis principal ajustado por las variables de estratificación presenta medias marginales de 237 mmHg en el sillón y 226 mmHg en la cama, mientras que la tabla suplementaria S7 muestra 228 y 219 mmHg tras un ajuste adicional por características basales potencialmente desequilibradas. Por tanto, estas cifras no constituyen por sí mismas una inconsistencia interna ni deben compararse como si provinieran del mismo modelo.

En Evaluación crítica, conservar únicamente la discrepancia real de cronología:

> Existe una discrepancia documental en el periodo de reclutamiento: la sección Methods sitúa el estudio entre junio de 2020 y agosto de 2024, mientras Results informa inclusiones entre junio de 2020 y junio de 2024. El registro oficial aporta fechas de evolución/finalización del estudio, pero no permite inferir por sí solo cuál fue la fecha del último reclutamiento. Esta discrepancia debe mantenerse separada de las medias marginales, que corresponden a modelos estadísticos distintos.

**Estado:** `P0 — CORRECCIÓN PROPUESTA / pendiente autorización clínica-editorial`.

### IDs 43, 45, 47 y 48

Auditoría documental previa disponible. Se verificarán y cerrarán en este mismo bloque antes de solicitar autorización para aplicar el lote clínico al JSON.

## Bloque B — contexto actual

Pendiente después del Bloque A. Orden inicial: 83 → 124 → 51 → 92 → 2 → 6 → 28 → 38 → 52 → 123 → 70. IDs 1 y 35 se mantienen sin cambio salvo nueva evidencia.

## Bloque C — inventario completo

Pendiente. Se auditarán los 168 resúmenes y se asignará estado documental a cada uno antes de cerrar el Paso 2.
