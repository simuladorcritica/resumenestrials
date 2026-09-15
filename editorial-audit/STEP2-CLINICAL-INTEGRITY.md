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

> Existe una discrepancia no resuelta entre la presentación gráfica de la supervivencia libre de LRA y la parametrización que el texto atribuye al modelo de Cox. El artículo informa HR 1,313 (IC 95% 0,773–2,229; p=0,313) para intervención frente a control y lo interpreta como un riesgo ligeramente mayor de LRA, aunque no significativo; sin embargo, la representación gráfica no resulta congruente de forma evidente con esa dirección. Con la información publicada no puede reconstruirse con seguridad la referencia/codificación exacta del modelo. No debe invertirse el HR ni presentarse la curva como confirmación de daño o beneficio; la discrepancia debe considerarse un problema de reporte que requeriría aclaración de los autores.

También debe eliminarse en cálculos derivados/conclusión cualquier frase que atribuya al conjunto «Kaplan–Meier/Cox» una dirección inequívoca si depende de esa lectura gráfica. La referencia debe indicar que el artículo fue publicado el 24/01/2026 y que la versión de registro figura posteriormente, sin presentar el 24/01 como una fecha inferida del PDF.

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

En Resultados:

> Conviene distinguir dos estimaciones procedentes de modelos distintos: el análisis principal ajustado por las variables de estratificación presenta medias marginales de 237 mmHg en el sillón y 226 mmHg en la cama, mientras que la tabla suplementaria S7 muestra 228 y 219 mmHg tras un ajuste adicional por características basales potencialmente desequilibradas. Por tanto, estas cifras no constituyen por sí mismas una inconsistencia interna ni deben compararse como si provinieran del mismo modelo.

En Evaluación crítica:

> Existe una discrepancia documental en el periodo de reclutamiento: la sección Methods sitúa el estudio entre junio de 2020 y agosto de 2024, mientras Results informa inclusiones entre junio de 2020 y junio de 2024. El registro oficial aporta fechas de evolución/finalización del estudio, pero no permite inferir por sí solo cuál fue la fecha del último reclutamiento. Esta discrepancia debe mantenerse separada de las medias marginales, que corresponden a modelos estadísticos distintos.

**Estado:** `P0 — CORRECCIÓN PROPUESTA / pendiente autorización clínica-editorial`.

### ID 43 — penetración pulmonar TOL/TAZ frente a CAZ/AVI

**Fuente primaria:** Benítez-Cano A et al. *Critical Care*. 2026;30:305. DOI `10.1186/s13054-026-06075-w`.

**Verificación:**

- Publicación electrónica: 13/05/2026; versión de registro: 11/06/2026. La referencia actual confunde la segunda con la primera.
- El estudio aleatorizó 30 pacientes (15 por rama) y analizó 298 muestras plasmáticas y 58 muestras de ELF.
- La documentación primaria distingue participantes, BAL y número de muestras ELF por fármaco; la ausencia de un BAL no convierte a un participante en no analizable para todas las matrices.
- El suplemento S3 deja vacío el número del umbral CT en una frase; el texto principal especifica 2 mg/L para tazobactam. No debe atribuirse 2 mg/L como lectura literal del hueco de S3.

**Corrección propuesta:** diferenciar expresamente fecha de publicación/versión, participantes/BAL/muestras y atribuir 2 mg/L al texto principal. Conservar la omisión de S3 como observación de reproducibilidad, no como contradicción resuelta por inferencia.

**Estado:** `P1 — CORRECCIÓN PROPUESTA / pendiente autorización clínica-editorial`.

### ID 48 — broncoscopia durante traqueostomía percutánea

**Fuente primaria:** Nachshon A et al. *Critical Care*. 2026;30:218. DOI `10.1186/s13054-026-05912-2`.

**Verificación:**

- Publicación electrónica: 18/03/2026; versión de registro: 28/04/2026.
- Results informa 313 pacientes aleatorizados: 156 sin broncoscopia y 157 con broncoscopia.
- Tras tres pérdidas de seguimiento en cada grupo, la tabla basal y el análisis final usan 153 y 154, total 307.
- El abstract usa 307 como «randomized», por lo que existe una imprecisión terminológica de la fuente; el resumen debe distinguir 313 aleatorizados de 307 analizados.
- En ClinicalTrials.gov, 13/04/2016 corresponde al envío inicial; la primera publicación pública del registro fue posterior. No modificar NCT02802527.

**Corrección propuesta:** corregir cronología bibliográfica y expresar 313 aleatorizados / 307 analizados, atribuyendo la discrepancia de 307 «randomized» al abstract sin alterar los desenlaces.

**Estado:** `P1 — CORRECCIÓN PROPUESTA / pendiente autorización clínica-editorial`.

### ID 45 — NEURO-CONDA

**Fuente primaria:** Murcia-Gubianas C et al. *Critical Care*. 2026;30:388. DOI `10.1186/s13054-026-06101-x`.

**Verificación:**

- Publicación electrónica: 28/05/2026; el valor de fecha usado era correcto, aunque su explicación como fecha provisional del PDF no lo era.
- El texto principal afirma comparabilidad basal; la tabla suplementaria del subgrupo TCE muestra edad 42,50 frente a 62,78 años, p=0,026.
- Una p aislada no demuestra por sí sola falta de comparabilidad clínica global ni invalida el ensayo; sí obliga a reconocer un desequilibrio de edad relevante en ese subgrupo exploratorio.
- Las tablas suplementarias muestran otras diferencias respiratorias/laboratorio que deben describirse con variables y tiempos concretos, sin convertirlas en prueba causal ni en acusación de ocultación.

**Corrección propuesta:** conservar las cifras pero sustituir «contradice la comparabilidad» por una formulación limitada: el desequilibrio cuestiona/limita la comparabilidad basal del subgrupo al menos respecto de la edad y debe considerarse al interpretar ese análisis exploratorio. Corregir además la explicación de la fecha de publicación.

**Estado:** `P1 — PRECISIÓN PROPUESTA / pendiente autorización clínica-editorial`.

### ID 47 — rehabilitación de miembro inferior en ICUAW

**Fuente primaria:** Xu L et al. *Critical Care*. 2026;30:66. DOI `10.1186/s13054-026-05840-1`. Protocolo: *BMJ Open* 2025;15:e093934. DOI `10.1136/bmjopen-2024-093934`.

**Verificación:**

- El artículo final declara cálculo mínimo de 54 participantes y «5%» de abandono para justificar 60 reclutados.
- La inflación matemática desde 54 con 5% corresponde a 57 participantes (ceil[54/(1−0,05)]); con 10% corresponde a 60.
- La auditoría del protocolo publicado confirma que éste especifica 10% para justificar 60. La discrepancia artículo/protocolo es real, pero no modifica los resultados del ensayo.
- El diseño es intrapaciente: 60 participantes, no 120 pacientes; cada miembro inferior se asigna intervención/control.
- Publicación electrónica: 16/01/2026; versión de registro: 10/02/2026.

**Corrección propuesta:** mantener la discrepancia 5% vs 10% claramente atribuida a las fuentes y no inflar el N como si fueran grupos independientes. Corregir la explicación bibliográfica de la fecha si el resumen la presenta como inferida del PDF.

**Estado:** `P2 — DISCREPANCIA DE FUENTE DOCUMENTADA / sin necesidad de alterar resultados`.

### Cierre provisional del Bloque A

Los seis casos conocidos han sido verificados documentalmente. Esto **no constituye aprobación humana clínica**. Cambios propuestos: 41, 43, 45, 46 y 48; ID 47 requiere principalmente conservar/documentar la discrepancia ya descrita y revisar coherencia editorial. Ningún cambio se ha aplicado todavía a `resumenes.json` en esta rama.

## Bloque B — contexto actual

Pendiente después del Bloque A. Orden inicial: 83 → 124 → 51 → 92 → 2 → 6 → 28 → 38 → 52 → 123 → 70. IDs 1 y 35 se mantienen sin cambio salvo nueva evidencia.

## Bloque C — inventario completo

Pendiente. Se auditarán los 168 resúmenes y se asignará estado documental a cada uno antes de cerrar el Paso 2.
