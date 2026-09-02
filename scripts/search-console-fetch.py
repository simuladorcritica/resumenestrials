"""Fetch aggregate Search Console data without storing credentials in the repository."""
from __future__ import annotations
import argparse, json, os
from datetime import date, timedelta
from pathlib import Path

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=180)
    parser.add_argument("--output", default="seo-data/search-console.json")
    args = parser.parse_args()
    encoded = os.environ.get("GSC_SERVICE_ACCOUNT_JSON", "")
    if not encoded:
        raise SystemExit("GSC_SERVICE_ACCOUNT_JSON no configurado; no se descargaron datos.")
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
    except ImportError as exc:
        raise SystemExit("Instala google-api-python-client y google-auth en el workflow.") from exc
    info = json.loads(encoded)
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/webmasters.readonly"]
    )
    service = build("searchconsole", "v1", credentials=creds, cache_discovery=False)
    end = date.today() - timedelta(days=3)
    start = end - timedelta(days=args.days - 1)
    rows, start_row = [], 0
    while True:
        body = {"startDate": str(start), "endDate": str(end), "dimensions": ["date", "query", "page"],
                "rowLimit": 25000, "startRow": start_row, "dataState": "final"}
        batch = service.searchanalytics().query(siteUrl="sc-domain:resumenestrials.com", body=body).execute().get("rows", [])
        for row in batch:
            day, query, page = row["keys"]
            rows.append({"date": day, "query": query, "page": page, "clicks": row.get("clicks", 0),
                         "impressions": row.get("impressions", 0), "ctr": row.get("ctr", 0), "position": row.get("position", 0)})
        if len(batch) < 25000: break
        start_row += len(batch)
    target = Path(args.output); target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({"property": "sc-domain:resumenestrials.com", "startDate": str(start), "endDate": str(end), "rows": rows}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"GSC PASS · {len(rows)} filas agregadas · {start} a {end}")
if __name__ == "__main__": main()
