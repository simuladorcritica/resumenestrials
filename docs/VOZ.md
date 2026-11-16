# Voz de los resúmenes completos

Decisión del editor (13 y 16 de noviembre de 2026): cada **resumen completo** se podrá escuchar con audio de calidad generado con Google Cloud Text-to-Speech; el resumen breve no lleva voz. Los archivos de audio no viven en este repositorio (irán a un almacén externo). Las cuentas y las claves son del editor y solo existen como secretos de GitHub: nunca se imprimen ni se versionan.

## Qué se lee

`tools/voz.py` arma el texto a partir del resumen **publicado** (`resumenes.json`):

1. Presentación: «Resúmenes Trials», el título, la revista y la fecha del artículo.
2. Todas las secciones de `cuerpo`, cada una con su título, **menos «Referencia y registro»** (sigue completa en la página; solo no se lee en voz alta).
3. Cierre: «Fin del resumen.»

## Cómo se lee

`leer()` solo cambia la forma de decir símbolos, unidades y abreviaturas estadísticas; no añade, quita ni cambia cifras ni palabras:

- `IC 95%` → «intervalo de confianza del 95 por ciento»; `p=0.03` → «p igual a 0.03»; `HR`, `OR`, `RR`, `DE`, `RIC`, `NNT`, `NNH` con su nombre completo.
- Unidades: `mmHg`, `mg/dl`, `ml/min/1.73 m²`, `µg/kg/min`, `cm H2O`… con todas sus letras.
- Signos: `−2.7` → «menos 2.7»; `0.41-0.92` → «0.41 a 0.92»; `46.9 − 33.0` → «46.9 menos 33.0»; `≥`, `≤`, `<`, `>`, `±`, `×`, `1:1`, `130/80`.
- Números romanos tras «fase», «clase», «tipo», APACHE, Killip…: `APACHE II` → «APACHE dos».
- Siglas clínicas y nombres de ensayos se dejan como están.

Las equivalencias viven en `tools/voz_lexico.json`. Si se cambia el léxico o una regla, sube `VERSION` en `tools/voz.py`.

## Guardas

`revisar(resumen)` (y `python tools/voz.py comprobar` para todos) exige, antes de generar la voz de un resumen:

- las **cifras** del texto leído son las mismas y en el mismo orden que las del publicado;
- no se pierde ni cambia de sitio **ninguna palabra**;
- no queda ningún signo sin regla de lectura;
- ningún trozo supera el límite de la API.

Un resumen que no pasa no recibe audio hasta que se añada la regla que falta. `python tools/test_voz.py` cubre las reglas, las guardas y los 332 resúmenes.

## Muestras de voz

El flujo **«Voz · muestras»** (`.github/workflows/voz-muestras.yml`) sintetiza el fragmento descrito en `tools/voz_muestras.json` con varias voces (Chirp 3 HD, Neural2 y WaveNet; mujer y hombre) y deja los MP3 en la rama suelta `voz-muestras`. Se lanza a mano o al cambiar ese archivo en `main`. Necesita el secreto `GOOGLE_TTS_API_KEY`.

## Lo que falta (siguientes entregas)

Elegida la voz: generación automática del audio de cada resumen al publicarse o corregirse, almacén externo, y el control «Escuchar» en la página del resumen completo.
