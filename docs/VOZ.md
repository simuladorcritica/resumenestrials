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
- **Nombres de ensayos:** se dicen de corrido, como palabras, no letra por letra (decisión del editor, 16-nov-2026): `ARISE FLUIDS` → «Arise Fluids», `ProMISe` → «Promise», `INTERACT4` → «Interact 4». Las palabras salen de lo que cada título lleva antes de los dos puntos (dos o más mayúsculas y más de tres letras); las siglas cortas (`ICU`, `CKD`, `AF`) y las que sí se deletrean (`ensayos_deletreados` del léxico) no se tocan, y `ensayos` fija los casos especiales (`STARRT` → «Start»).
- **En inglés:** los nombres de los ensayos y de las revistas se dicen **como suenan en inglés** (decisión del editor, 16-nov-2026). Con las voces que admiten SSML, `leer(texto, marcas=True)` y `bloques(resumen, marcas=True)` devuelven el mismo texto con cada nombre entre marcas, y `ssml()` las convierte en `<lang xml:lang="en-US">…</lang>`: la misma voz dice el nombre en inglés, también en los ensayos que entren después, sin escribir a mano la pronunciación de cada uno. Solo se marca lo que en el texto publicado está escrito como nombre de ensayo (`OPTIMAL-DIABETES` sí; la palabra «Diabetes» no). La cifra final (`ANDROMEDA-SHOCK-2`) queda fuera y se dice en español.
- Las siglas clínicas (APACHE, SOFA, UCI, VIH…) se dejan como están.

Las equivalencias viven en `tools/voz_lexico.json`. Si se cambia el léxico o una regla, sube `VERSION` en `tools/voz.py` (queda anotada en cada audio). Un cambio así solo obliga a generar de nuevo los resúmenes cuya lectura cambia de verdad; aun así, una regla que toque a muchos resúmenes gasta parte del tope mensual, así que conviene juntar las correcciones.

## Guardas

`revisar(resumen)` (y `python tools/voz.py comprobar` para todos) exige, antes de generar la voz de un resumen:

- las **cifras** del texto leído son las mismas y en el mismo orden que las del publicado;
- no se pierde ni cambia de sitio **ninguna palabra**;
- no queda ningún signo sin regla de lectura;
- ningún trozo supera el límite de la API;
- con las marcas de los nombres se lee **exactamente** lo mismo, y el SSML no añade más que etiquetas.

Un resumen que no pasa no recibe audio hasta que se añada la regla que falta. `python tools/test_voz.py` cubre las reglas, las guardas y los 332 resúmenes.

## Muestras de voz

**Voz elegida por el editor (16-nov-2026): `es-US-Wavenet-B`** (hombre). Se descartaron Chirp 3 HD (no admite SSML y cuesta más) y Neural2 (en español suena igual que WaveNet y cuesta cuatro veces más).

El flujo **«Voz · muestras»** (`.github/workflows/voz-muestras.yml`) sintetiza lo que describe `tools/voz_muestras.json` y deja los MP3 en la rama suelta `voz-muestras`. Se lanza a mano o al cambiar ese archivo en `main`. Necesita el secreto `GOOGLE_TTS_API_KEY`. El plan admite voces por su nombre (`voces`) o por familia y género (`familias`), fragmentos o el resumen entero (`"completo": true`) y variantes de prueba: `cambios` (otra forma de escribir algo, solo en la muestra) e `"ingles": true` (los nombres en inglés con SSML; solo en voces que lo admiten).

## Generación y almacén

Decisiones del editor (16-nov-2026): voz `es-US-Wavenet-B`, nombres en inglés y pronunciación aprobada con el resumen completo de ARISE FLUIDS. Los audios viven en un cubo de Cloudflare R2 con dominio público (`audio.resumenestrials.com`).

`python tools/voz.py generar` (flujo **«Voz · generar»**, `.github/workflows/voz-generar.yml`) hace, en este orden:

1. Calcula la **huella** de cada resumen publicado que pasa las guardas: un resumen de lo que se envía a leer (el SSML), la voz y el formato. Cambia solo si cambia lo que se lee.
2. **Retira** del almacén la ficha y el audio de todo resumen cuya huella ya no coincide (texto corregido, resumen retirado, regla nueva que le afecta). Así la página nunca ofrece un audio que ya no corresponde, aunque después falle la generación.
3. Genera los que faltan, del artículo más reciente al más antiguo: sintetiza las peticiones, une los MP3, comprueba que el resultado es una sucesión limpia de tramas y lo sube.

En el almacén quedan:

- `resumenes/<id>/<huella>.mp3`: el audio (caché de un año; el nombre nunca se reutiliza).
- `resumenes/<id>.json`: la ficha (`audio`, `segundos`, `bytes`, `huella`, `voz`). **Existe solo si el audio vigente existe**: es lo que consultará la página para mostrar «Escuchar».
- `indice.json`: todas las fichas. `estado/uso.json`: caracteres enviados a Google cada mes.

`tools/voz_plan.json` gobierna la generación: con `"automatico": false` solo se generan los resúmenes de `piloto`; `tope_mensual` (3 900 000 caracteres: la parte gratuita de WaveNet es de 4 millones al mes) nunca se supera; `maximo_por_ejecucion` reparte el trabajo. El flujo corre al cambiar en `main` `resumenes.json`, `tools/voz.py`, el léxico o el plan, una vez al día y a mano («Run workflow», con `ids` y `maximo` opcionales). Deja su informe en la rama suelta `voz-estado`.

Secretos de GitHub (los crea y guarda el editor; nunca se imprimen): `GOOGLE_TTS_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_BUCKET`. Sin ellos el flujo termina con un aviso y sin fallar.

## Lo que falta (siguientes entregas)

Aprobado el piloto: pasar el plan a automático (todo el archivo, dentro del tope mensual) y el control «Escuchar» en la página del resumen completo, que aparece solo si la ficha del audio existe.
