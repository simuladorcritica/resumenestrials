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
- **Revistas:** se dicen con su nombre completo, en inglés (`NEJM` → «The New England Journal of Medicine», `Crit Care Med` → «Critical Care Medicine»). El nombre sale de `revistas`, en `tools/voz_lexico.json`. Si llega un resumen de una revista que no está ahí, `revisar()` lo señala y no se le genera audio hasta añadirla (aparece en `con_problemas` del informe): así la voz nunca lee una abreviatura tal cual.

Las equivalencias viven en `tools/voz_lexico.json`. Si se cambia el léxico o una regla, sube `VERSION` en `tools/voz.py` (queda anotada en cada audio). Un cambio así solo obliga a generar de nuevo los resúmenes cuya lectura cambia de verdad; aun así, una regla que toque a muchos resúmenes gasta parte del tope mensual, así que conviene juntar las correcciones.

## Guardas

`revisar(resumen)` (y `python tools/voz.py comprobar` para todos) exige, antes de generar la voz de un resumen:

- las **cifras** del texto leído son las mismas y en el mismo orden que las del publicado;
- no se pierde ni cambia de sitio **ninguna palabra**;
- no queda ningún signo sin regla de lectura;
- ningún trozo supera el límite de la API;
- con las marcas de los nombres se lee **exactamente** lo mismo, y el SSML no añade más que etiquetas.

Un resumen que no pasa no recibe audio hasta que se añada la regla que falta. `python tools/test_voz.py` cubre las reglas, las guardas, todos los resúmenes publicados y la generación (orden, cupo, partes, audios anteriores y avisos) con un almacén y una voz simulados.

## Muestras de voz

**Voz elegida por el editor (16-nov-2026): `es-US-Wavenet-B`** (hombre). Se descartaron Chirp 3 HD (no admite SSML y cuesta más) y Neural2 (en español suena igual que WaveNet y cuesta cuatro veces más).

El flujo **«Voz · muestras»** (`.github/workflows/voz-muestras.yml`) sintetiza lo que describe `tools/voz_muestras.json` y deja los MP3 en la rama suelta `voz-muestras`. Se lanza a mano o al cambiar ese archivo en `main`. Necesita el secreto `GOOGLE_TTS_API_KEY`. El plan admite voces por su nombre (`voces`) o por familia y género (`familias`), fragmentos o el resumen entero (`"completo": true`) y variantes de prueba: `cambios` (otra forma de escribir algo, solo en la muestra) e `"ingles": true` (los nombres en inglés con SSML; solo en voces que lo admiten).

## Generación y almacén

Decisiones del editor (16-nov-2026): voz `es-US-Wavenet-B`, nombres en inglés y pronunciación aprobada con el resumen completo de ARISE FLUIDS. Los audios viven en un cubo de Cloudflare R2 con dominio público (`audio.resumenestrials.com`).

**El audio sigue al texto publicado** (decisiones del editor, 17-nov-2026): un resumen nuevo recibe su audio; uno corregido pierde el anterior y recibe el nuevo; y **nunca se paga**: si la parte gratuita del mes no alcanza, lo que no cabe espera en cola al mes siguiente.

`python tools/voz.py generar` (flujo **«Voz · generar»**, `.github/workflows/voz-generar.yml`) hace, en este orden:

1. Calcula la **huella** de cada resumen publicado que pasa las guardas: un resumen de lo que se envía a leer (el SSML), la voz y el formato. Cambia solo si cambia lo que se lee: una corrección que no toca lo leído (la fecha de revisión, por ejemplo) no cambia el audio.
2. **Retira** del almacén la ficha y el audio de todo resumen cuyo texto publicado cambió (o que se retiró del sitio, o que dejó de pasar las guardas). Así la página nunca ofrece un audio que ya no corresponde, aunque después falle la generación. El resumen que pierde su audio y sigue publicado queda anotado como **corregido**.
3. Genera los que faltan, **por orden**: primero los corregidos (y los que el plan pone en `prioridad`), después los nuevos (publicados en el sitio en los últimos `dias_nuevo` días, del más reciente al más antiguo) y al final el archivo antiguo (por fecha del artículo); lo último, las renovaciones.
4. **Avisa al editor** por el canal de alertas de Telegram, una sola vez, de lo que se queda sin audio: los corregidos y nuevos que esperan cupo, un resumen que no pasa una guarda o un error de la generación; y cuando los que esperaban ya tienen audio. Si el aviso no sale, se reintenta en la ejecución siguiente. Las ejecuciones parciales pedidas a mano no avisan.

**Por partes.** Cada resumen se lee en partes estables (`partes()`): la presentación, cada sección con su título y el cierre. Cada parte se envía por separado y su audio se guarda en `partes/`; el audio del resumen es la suma, en orden, de sus partes. Al corregir un resumen solo se vuelve a generar (y a contar en el cupo) la parte que cambió: entre 1 000 y 4 000 caracteres en vez de unos 15 000. Si la generación falla a medias, lo ya generado no se pierde ni se paga otra vez. Las partes que ya no usa ningún audio se borran.

**Si cambia la forma de leer y no el texto.** Cada audio anota el texto publicado al que corresponde (`fuente()`: título, revista, fecha y cuerpo). Si el texto es el mismo y lo que cambió es una regla de lectura, el léxico o la voz, el audio sigue siendo fiel al resumen: **no se retira**; pasa a la cola de renovación (`en_cola.renovar`), detrás de todo lo demás, y se sustituye cuando hay cupo (de cada uno se paga solo la parte que cambia). Así un cambio de reglas nunca deja de golpe sin audio a muchos resúmenes. Una corrección del texto, en cambio, retira el audio siempre y en el acto.

**Audios anteriores.** Los generados hasta el 17-nov-2026 se enviaban de corrido, sin atender a las secciones, y su huella sale de esa forma de partir (`huella_anterior()`). Siguen siendo válidos mientras su texto no cambie: ninguno se genera de nuevo por este cambio. La primera vez que uno de ellos se corrige se generan todas sus partes; desde entonces, solo la que cambie.

**Cupo.** `tope_mensual` (3 900 000 caracteres; la parte gratuita de WaveNet es de 4 millones al mes) nunca se supera. El archivo antiguo y las renovaciones, además, no tocan la `reserva_mensual` (2 400 000), que se libera día a día: al empezar el mes solo puede llevar el gasto hasta `tope − reserva` y al acabarlo hasta el tope, así que solo usa el cupo que los corregidos y los nuevos van dejando libre. Cuando un resumen no cabe, la ejecución se detiene (`detenido_por`: «tope mensual» o «reserva del mes») y todo lo pendiente queda en `en_cola` (corregidos, nuevos y archivo) hasta que haya cupo; el día 1 se atiende solo.

En el almacén quedan:

- `resumenes/<id>/<huella>.mp3`: el audio (caché de un año; el nombre nunca se reutiliza).
- `resumenes/<id>.json`: la ficha (`audio`, `segundos`, `bytes`, `huella`, `voz`). **Existe solo si el audio vigente existe**: es lo que consulta la página para mostrar «Escuchar».
- `partes/<huella>.mp3`: el audio de cada parte leída (lo que dos resúmenes dicen igual, como el cierre, se guarda una vez).
- `indice.json`: todas las fichas, con las partes de cada una, y los corregidos que esperan su audio. `estado/uso.json`: caracteres enviados a Google cada mes. `estado/avisos.json`: lo ya avisado al editor.

`tools/voz_plan.json` gobierna la generación: con `"automatico": false` solo se generan los resúmenes de `piloto`; `tope_mensual`, `reserva_mensual`, `dias_nuevo` y `prioridad` son los de arriba; `maximo_por_ejecucion` reparte el trabajo. El flujo corre al cambiar en `main` `resumenes.json`, `tools/voz.py`, el léxico o el plan, una vez al día y a mano («Run workflow», con `ids` y `maximo` opcionales). Deja su informe en la rama suelta `voz-estado`.

Secretos de GitHub (los crea y guarda el editor; nunca se imprimen): `GOOGLE_TTS_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_BUCKET`. Sin ellos el flujo termina con un aviso y sin fallar. Para los avisos usa `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`, los mismos del canal de alertas; sin ellos el aviso queda solo en el registro de la ejecución y en el informe.

## Estado

- 16-nov-2026: tras el piloto (resúmenes 2, 69 y 113), el editor aprobó generar todo el archivo **sin salir de la parte gratuita**.
- 17-nov-2026: el control «Escuchar» está publicado (`reader-audio.js`); la página recuerda por dónde iba cada lector **por versión del audio**, de modo que tras una corrección el audio nuevo empieza desde el principio. Con 340 resúmenes y unos 165 nuevos al mes, la parte gratuita (unos 270 resúmenes enteros al mes) alcanza en régimen normal; mientras se pone al día el archivo puede haber cola a final de mes, que se atiende el día 1.
