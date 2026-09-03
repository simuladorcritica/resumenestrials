"""Obtiene una vez el refresh token OAuth de Search Console en el equipo local."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
DEFAULT_OUTPUT = ".secrets/gsc-oauth-bootstrap.json"


def load_client_config(path: str | None) -> tuple[dict, str, str]:
    if path:
        source = Path(path)
        try:
            config = json.loads(source.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise SystemExit(f"No fue posible leer un JSON OAuth válido desde {source}.") from exc
        installed = config.get("installed")
        if not isinstance(installed, dict):
            raise SystemExit("El JSON debe pertenecer a un cliente OAuth de tipo Desktop app.")
        client_id = str(installed.get("client_id") or "").strip()
        client_secret = str(installed.get("client_secret") or "").strip()
        if not client_id or not client_secret:
            raise SystemExit("El JSON OAuth no contiene client_id y client_secret.")
        return config, client_id, client_secret

    client_id = os.environ.get("GSC_OAUTH_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GSC_OAUTH_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise SystemExit(
            "Proporciona --client-secrets con el JSON Desktop descargado de Google Cloud "
            "o define GSC_OAUTH_CLIENT_ID y GSC_OAUTH_CLIENT_SECRET."
        )
    config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }
    return config, client_id, client_secret


def secure_write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as output:
        json.dump(payload, output, ensure_ascii=False, indent=2)
        output.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--client-secrets", help="JSON de un cliente OAuth Desktop app")
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError as exc:
        raise SystemExit("Instala google-auth-oauthlib antes de ejecutar este asistente.") from exc

    config, client_id, client_secret = load_client_config(args.client_secrets)
    flow = InstalledAppFlow.from_client_config(config, scopes=[SCOPE])
    credentials = flow.run_local_server(
        host="127.0.0.1",
        port=0,
        open_browser=True,
        access_type="offline",
        prompt="consent",
        authorization_prompt_message=(
            "Se abrirá Google para autorizar acceso de solo lectura a Search Console."
        ),
        success_message="Autorización completada. Puedes cerrar esta ventana.",
    )
    if not credentials.refresh_token:
        raise SystemExit(
            "Google no devolvió un refresh token. Revoca el permiso anterior y repite el flujo."
        )
    granted = set(credentials.granted_scopes or credentials.scopes or [])
    if SCOPE not in granted:
        raise SystemExit("La autorización no concedió el alcance de solo lectura requerido.")

    target = Path(args.output)
    secure_write(
        target,
        {
            "GSC_OAUTH_CLIENT_ID": client_id,
            "GSC_OAUTH_CLIENT_SECRET": client_secret,
            "GSC_OAUTH_REFRESH_TOKEN": credentials.refresh_token,
            "GSC_SITE_URL": "sc-domain:resumenestrials.com",
            "scope": SCOPE,
        },
    )
    print(f"OAuth GSC PASS · credenciales guardadas localmente en {target}")
    print("El contenido no se mostrará. Copia los tres valores OAuth a GitHub Secrets y elimina el archivo cuando termines.")


if __name__ == "__main__":
    main()
