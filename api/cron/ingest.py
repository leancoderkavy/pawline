import json
import os
from http.server import BaseHTTPRequestHandler

from scripts.ingest import run


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        expected = os.environ.get("CRON_SECRET")
        supplied = self.headers.get("Authorization", "")
        if not expected or supplied != f"Bearer {expected}":
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"Unauthorized"}')
            return
        try:
            results = run()
            payload = json.dumps({"ok": True, "results": results}).encode()
            self.send_response(200)
        except Exception:
            payload = b'{"ok":false,"error":"Ingestion failed"}'
            self.send_response(500)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)
