"""Descarga métricas agregadas de Search Console sin exponer credenciales."""
from __future__ import annotations

import argparse
import json
import os
from datetime import date, timedelta
from pathlib import Path

SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
DEFAULT_SITE = "sc-domain:resumenestrials.com"


def credentials_from_environment():
    """Prefiere OAuth de usuario y conserva la cuenta de servicio como respaldo."""
    client_id = os.environ.get("GSC_OAUTH_CLIENT_ID", "").strip()
    client_secret = os.environ.get("GSC_OAUTH_CLIENT_SECRET", "").strip()
    refresh_token = os.environ.get("GSC_OAUTH_REFRESH_TOKEN", "").strip()
    oauth_values = [client_id, client_secret, refresh_token]

    if any(oauth_values) and not all(oauth_values):
        raise SystemExit(
            "Configuración OAuth incompleta: se requieren GSC_OAUTH_CLIENT_ID, "
            "GSC_OAUTH_CLIENT_SECRET y GSC_OAUTH_REFRESH_TOKEN."
        )

    if all(oauth_values):
        from google.auth.exceptions import RefreshError
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials

        credentials = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=[SCOPE],
        )
        try:
            credentials.refresh(Request())
        except RefreshError as exc:
            if "invalid_grant" in str(exc).lower():
                message = (
                    "OAuth refresh token expiró o fue revocado (invalid_grant). "
                    "Vuelve a ejecutar scripts/gsc-oauth-bootstrap.py."
                )
            else:
                message = (
                    "OAuth de Search Console no pudo renovarse. Comprueba que el cliente "
                    "y el refresh token correspondan y repite el bootstrap si es necesario."
                )
            raise SystemExit(message) from exc
        return credentials, "oauth-user"

    service_account_json = os.environ.get("GSC_SERVICE_ACCOUNT_JSON", "").strip()
    if service_account_json:
        from google.oauth2 import service_account

        try:
            info = json.loads(service_account_json)
        except json.JSONDecodeError as exc:
            raise SystemExit("GSC_SERVICE_ACCOUNT_JSON no contiene JSON válido.") from exc
        return (
            service_account.Credentials.from_service_account_info(info, scopes=[SCOPE]),
            "service-account",
        )

    raise SystemExit(
        "Search Console no configurado: faltan las tres credenciales OAuth o "
        "GSC_SERVICE_ACCOUNT_JSON como respaldo."
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=180)
    parser.add_argument("--output", default="seo-data/search-console.json")
    parser.add_argument("--site-url", default=os.environ.get("GSC_SITE_URL", DEFAULT_SITE))
    args = parser.parse_args()
    if args.days < 1:
        raise SystemExit("--days debe ser mayor que cero.")

    try:
        from googleapiclient.discovery import build
        from googleapiclient.errors import HttpError
    except ImportError as exc:
        raise SystemExit(
            "Instala google-api-python-client y google-auth para consultar Search Console."
        ) from exc

    credentials, provider = credentials_from_environment()
    service = build("searchconsole", "v1", credentials=credentials, cache_discovery=False)
    end = date.today() - timedelta(days=3)
    start = end - timedelta(days=args.days - 1)
    rows: list[dict] = []
    start_row = 0

    try:
        while True:
            body = {
                "startDate": str(start),
                "endDate": str(end),
                "dimensions": ["date", "query", "page"],
                "rowLimit": 25000,
                "startRow": start_row,
                "dataState": "final",
            }
            batch = (
                service.searchanalytics()
                .query(siteUrl=args.site_url, body=body)
                .execute()
                .get("rows", [])
            )
            for row in batch:
                day, query, page = row["keys"]
                rows.append(
                    {
                        "date": day,
                        "query": query,
                        "page": page,
                        "clicks": row.get("clicks", 0),
                        "impressions": row.get("impressions", 0),
                        "ctr": row.get("ctr", 0),
                        "position": row.get("position", 0),
                    }
                )
            if len(batch) < 25000:
                break
            start_row += len(batch)
    except HttpError as exc:
        status = getattr(exc.resp, "status", "desconocido")
        raise SystemExit(
            f"Search Console rechazó la consulta (HTTP {status}). Comprueba que la API "
            f"esté activa y que la cuenta autorizada tenga acceso a {args.site_url}."
        ) from exc

    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(
            {
                "property": args.site_url,
                "startDate": str(start),
                "endDate": str(end),
                "credentialProvider": provider,
                "rows": rows,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"GSC PASS · {len(rows)} filas agregadas · {start} a {end} · {provider}")


if __name__ == "__main__":
    main()
