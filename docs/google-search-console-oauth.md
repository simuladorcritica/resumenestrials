# Google Search Console con OAuth de usuario

Esta integración consulta únicamente la propiedad `sc-domain:resumenestrials.com` y solicita el alcance mínimo `https://www.googleapis.com/auth/webmasters.readonly`. No puede escribir en Search Console.

## 1. Preparar Google Cloud

1. Crea o selecciona un proyecto en Google Cloud Console y activa **Google Search Console API**.
2. Configura la pantalla de consentimiento OAuth con el nombre **Resúmenes Trials**, el correo de soporte `resumenestrials@outlook.com`, la página principal `https://resumenestrials.com/` y la política `https://resumenestrials.com/privacidad/`.
3. Añade solo el scope `https://www.googleapis.com/auth/webmasters.readonly`.
4. Crea credenciales OAuth de tipo **Desktop app**, con el nombre sugerido **Resúmenes Trials SEO Desktop**, y descarga el JSON localmente, fuera del repositorio.
5. La Cuenta de Google que autorice debe tener acceso a la propiedad exacta de Search Console.

Si la pantalla externa permanece en **Testing**, Google limita la autorización de un usuario de prueba a siete días, incluido el refresh token. Para una automatización estable, revisa los requisitos vigentes y cambia el estado a **In production** cuando corresponda. La publicación no amplía el scope solicitado por el código.

Mientras la app esté en Testing, añade como usuario de prueba la Cuenta de Google propietaria de Search Console. En **Audience**, mantén el tipo **External**. Configura también `resumenestrials.com` como dominio autorizado y usa `resumenestrials@outlook.com` tanto para soporte como para contacto del desarrollador.

## 2. Obtener el refresh token una sola vez

Instala la biblioteca local y ejecuta el asistente desde la raíz del repositorio:

```powershell
python -m pip install google-auth-oauthlib==1.2.2
python scripts/gsc-oauth-bootstrap.py --client-secrets "C:\ruta\client_secret.json"
```

El navegador abrirá el consentimiento de Google y volverá a un puerto local temporal. El resultado queda en `.secrets/gsc-oauth-bootstrap.json`, ruta ignorada por Git. El programa no imprime los valores. Elimina tanto el JSON descargado de Google como el archivo temporal después de configurar GitHub.

## 3. Crear GitHub Secrets

Copia los valores del archivo temporal a **Settings → Secrets and variables → Actions**:

- `GSC_OAUTH_CLIENT_ID`
- `GSC_OAUTH_CLIENT_SECRET`
- `GSC_OAUTH_REFRESH_TOKEN`

`GSC_SITE_URL` no es secreto; el workflow lo fija como `sc-domain:resumenestrials.com`. `GSC_SERVICE_ACCOUNT_JSON` queda admitido únicamente como respaldo heredado. Si están presentes los tres secretos OAuth, OAuth tiene prioridad.

## 4. Comportamiento seguro del workflow

- Sin credenciales, una PR genera los reportes técnicos y muestra que Search Console fue omitido.
- La vigilancia de nuevas altas usa Search Analytics y, desde D14 hasta D90, URL Inspection en modo de solo lectura. No usa Google Indexing API ni solicita indexación.
- Los estados se mantienen separados: publicación técnica, descubribilidad, indexación confirmada cuando la API lo permite, impresiones y clics.
- Si existe solo una parte de la terna OAuth, la ejecución falla con un mensaje de configuración incompleta.
- Con OAuth completo, `scripts/search-console-fetch.py` renueva un access token efímero y consulta Search Analytics.
- El parámetro `--days` permite ventanas de 7, 28 o 90 días cuando se necesiten; la descarga programada amplia permite calcular comparaciones semanales y mensuales sin nuevas autorizaciones.
- Si Google devuelve una revocación, caducidad o `invalid_grant`, la ejecución falla sin imprimir tokens y pide repetir el bootstrap.
- En desarrollo local, `seo-data/search-console.json` está ignorado por Git. En GitHub Actions, el dataset y los reportes derivados se escriben únicamente en `$RUNNER_TEMP/gsc/`, se excluyen de logs, summaries, caches y artefactos, y se eliminan al finalizar el job. Si Resend está disponible, el informe detallado se entrega solo a `resumenestrials@outlook.com`; si no, permanece efímero.

## 5. Revocar o rotar

El acceso puede retirarse en <https://myaccount.google.com/connections>. Después, elimina o reemplaza los tres secretos OAuth de GitHub. Para rotar el cliente o recuperar un token caducado, repite el flujo y sustituye los tres valores como una unidad.

## 6. Pasar de Testing a producción

1. Comprueba que la página principal, la política y los términos estén publicados por HTTPS y enlazados entre sí.
2. En Google Auth Platform revisa **Branding**, **Audience** y **Data Access**; confirma que el único scope sea `webmasters.readonly`.
3. Desde **Audience**, selecciona **Publish app** o **In production** siguiendo la interfaz vigente.
4. Si Google solicita verificación de marca, del dominio o del scope, entrega la información mediante el proceso oficial y espera su resolución. No marques la app como verificada ni intentes eludir esa revisión.
5. Una vez que el estado aplicable sea de producción, repite el bootstrap para obtener un refresh token nuevo y reemplaza conjuntamente los tres secretos en GitHub.

Publicar la app y completar cualquier verificación es una acción humana en la cuenta de Google Cloud. El repositorio solo deja preparada y comprobada la integración.

Referencias oficiales:

- <https://developers.google.com/webmaster-tools/v1/how-tos/authorizing>
- <https://developers.google.com/identity/protocols/oauth2/native-app>
- <https://developers.google.com/identity/protocols/oauth2>
- <https://developers.google.com/terms/api-services-user-data-policy>
