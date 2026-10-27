"""Small development API adapter for the scraper's CSV snapshots.

Production deployments should replace the repository with parameterized MariaDB
queries while keeping this JSON contract. Browser observations are deliberately
stored separately from trusted scraper snapshots.
"""
from __future__ import annotations
import csv, json, os, re
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

DATA_DIR = Path(os.environ.get("ENCOMERCIALES_DATA_DIR", "../enComerciales/eC_scraperFull/data")).resolve()
OBSERVATIONS = Path(os.environ.get("ENCOMERCIALES_OBSERVATIONS", "observations.jsonl")).resolve()
ALLOWED_ORIGINS = {origin.strip() for origin in os.environ.get("ENCOMERCIALES_ALLOWED_ORIGINS", "chrome-extension://,moz-extension://,http://localhost").split(",")}
ALLOWED_RETAILER_HOSTS = {host.strip().lower() for host in os.environ.get("ENCOMERCIALES_RETAILER_HOSTS", "vinoteca.com,bodegasalianza.com,laeuropea.com.mx,elpalaciodehierro.com,lacastellana.com,liverpool.com.mx").split(",")}

def money(value):
    try: return float(value) if value not in (None, "") else None
    except (TypeError, ValueError): return None

def rows():
    result = []
    for path in DATA_DIR.glob("*_precios.csv"):
        try:
            with path.open(encoding="utf-8-sig", newline="") as handle:
                for row in csv.DictReader(handle):
                    value = money(row.get("PrecioNumerico")); name = row.get("Nombre", "").strip()
                    if name and value is not None: result.append({"name": name, "price": value, "store": row.get("Tienda", ""), "date": row.get("Fecha", ""), "url": row.get("Links", ""), "currency": row.get("Moneda", "MXN")})
        except OSError: continue
    return result

def product_id(name): return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:100]
def match(query, row):
    tokens = set(re.findall(r"[a-z0-9]+", query.lower()))
    words = set(re.findall(r"[a-z0-9]+", row["name"].lower()))
    return len(tokens & words) / max(len(tokens), 1)

def allowed_origin(origin):
    return not origin or any(origin == allowed or origin.startswith(allowed) for allowed in ALLOWED_ORIGINS)

def allowed_retailer_url(url):
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and any(host == allowed or host.endswith("." + allowed) for allowed in ALLOWED_RETAILER_HOSTS)

def search(params):
    query = params.get("name", [""])[0]; data = sorted((row for row in rows() if match(query, row) >= .35), key=lambda row: match(query, row), reverse=True)[:int(params.get("limit", [5])[0])]
    return {"products": [{"id": product_id(row["name"]), "name": row["name"], "matchConfidence": "HIGH" if match(query, row) >= .8 else "MEDIUM", "retailer": row["store"]} for row in data]}

def history(identifier):
    data = [row for row in rows() if product_id(row["name"]) == identifier]
    prices = [row["price"] for row in data]; average = sum(prices) / len(prices) if prices else None
    best = min(data, key=lambda row: row["price"], default=None)
    ordered = sorted(data, key=lambda row: row["date"]); current = ordered[-1] if ordered else None
    today = datetime.now(timezone.utc).date()
    def window_average(days):
        values = [row["price"] for row in data if row["date"] and today - datetime.strptime(row["date"], "%Y-%m-%d").date() <= timedelta(days=days)]
        return sum(values) / len(values) if values else None
    stats = {"low": min(prices) if prices else None, "high": max(prices) if prices else None, "average": average, "average30d": window_average(30), "average90d": window_average(90), "average1y": window_average(365), "historicalLow": min(prices) if prices else None, "historicalHigh": max(prices) if prices else None, "historicalAverage": average, "bestStore": best["store"] if best else None, "dateOfLow": best["date"] if best else None, "lastUpdated": max((row["date"] for row in data), default=None), "observations": len(prices)}
    rating = {"category": "INSUFFICIENT DATA", "reason": "Fewer than three trusted observations are available."}
    if current and len(prices) >= 3 and average:
        delta = (current["price"] - average) / average
        category = "GREAT DEAL" if delta <= -.10 or (stats["low"] is not None and current["price"] <= stats["low"] * 1.02) else "GOOD DEAL" if delta <= -.03 else "NORMAL PRICE" if delta <= .10 else "EXPENSIVE"
        rating = {"category": category, "reason": f"Current price is {abs(delta) * 100:.1f}% {'below' if delta < 0 else 'above'} the historical average."}
    history_rows = [{"date": row["date"], "price": row["price"], "salePrice": None, "store": row["store"]} for row in ordered]
    latest_by_store = {}
    for row in reversed(ordered):
        if row["store"] not in latest_by_store: latest_by_store[row["store"]] = {"store": row["store"], "price": row["price"], "date": row["date"], "url": row["url"]}
    return {"product": {"name": data[0]["name"] if data else None}, "match": {"confidence": "EXACT", "method": "csv-product-id", "reason": "The local CSV product identifier was selected."}, "current": current, "statistics": stats, "stats": stats, "rating": rating, "history": history_rows, "stores": list(latest_by_store.values())}

class CSVRepository:
    """Development repository implementing the same read contract as PHP's DatabaseRepository."""

    def search(self, params):
        return search(params)

    def history(self, identifier):
        return history(identifier)

    def health(self):
        return {"status": "ok", "apiVersion": "1.1", "database": "csv"}

CSV_REPOSITORY = CSVRepository()

class Handler(BaseHTTPRequestHandler):
    def json(self, status, payload):
        origin = self.headers.get("Origin", "")
        self.send_response(status); self.send_header("Content-Type", "application/json; charset=utf-8")
        if allowed_origin(origin):
            if origin: self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers(); self.wfile.write(json.dumps(payload, ensure_ascii=False).encode())
    def do_OPTIONS(self):
        if not allowed_origin(self.headers.get("Origin", "")): return self.json(403, {"error": "ORIGIN_NOT_ALLOWED"})
        self.send_response(204); self.send_header("Access-Control-Allow-Headers", "Content-Type"); self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS"); self.end_headers()
    def do_GET(self):
        parsed = urlparse(self.path); params = parse_qs(parsed.query)
        if parsed.path in {"/health", "/api/health"}: return self.json(200, CSV_REPOSITORY.health())
        if parsed.path == "/api/products/search": return self.json(200, CSV_REPOSITORY.search(params))
        if parsed.path == "/api/products/history": return self.json(200, CSV_REPOSITORY.history(params.get("id", [""])[0]))
        if parsed.path == "/api/products/compare": return self.json(200, CSV_REPOSITORY.search(params))
        return self.json(404, {"error": "NOT_FOUND"})
    def do_POST(self):
        if self.path != "/api/prices/observe": return self.json(404, {"error": "NOT_FOUND"})
        try: payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
        except (ValueError, json.JSONDecodeError): return self.json(400, {"error": "INVALID_JSON"})
        required = {"name", "retailer", "url", "price", "currency", "extractionMethod", "matchConfidence"}
        if not required.issubset(payload) or not isinstance(payload.get("url"), str) or not allowed_retailer_url(payload["url"]) or not isinstance(payload.get("price"), (int, float)) or payload["price"] <= 0: return self.json(400, {"error": "INVALID_OBSERVATION"})
        payload.update({"source": "BROWSER_EXTENSION", "observedAt": datetime.now(timezone.utc).isoformat()})
        OBSERVATIONS.parent.mkdir(parents=True, exist_ok=True); with_file = OBSERVATIONS.open("a", encoding="utf-8"); with_file.write(json.dumps(payload) + "\n"); with_file.close()
        return self.json(202, {"accepted": True, "source": payload["source"]})
    def log_message(self, *_): pass

if __name__ == "__main__":
    ThreadingHTTPServer((os.environ.get("ENCOMERCIALES_API_HOST", "127.0.0.1"), int(os.environ.get("ENCOMERCIALES_API_PORT", "8080"))), Handler).serve_forever()
