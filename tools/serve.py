"""Local dev server for the site, reachable on the LAN: static files from the site folder, /api/* forwarded to the PIE
translator (scripts/translator_server.py, 127.0.0.1:8765) and /api/tts to the live voices (tools/tts_server.py,
127.0.0.1:8766), so the page calls them from the same origin.
On Cloudflare the same paths will be a Worker.

    python3 -I tools/serve.py [port]          # default 4747, binds 0.0.0.0
"""
import http.server
import json
import socketserver
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "http://127.0.0.1:8765"
TTS = "http://127.0.0.1:8766"          # tools/tts_server.py: the live voices (/api/tts, /api/tts/health)
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4747


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")          # a draft: always the latest file
        super().end_headers()

    def do_GET(self):
        if self.path.startswith("/api/tts/health"):
            return self._forward(TTS + "/health", None, "voices")
        return super().do_GET()

    def _forward(self, url, body, what):
        try:
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                out, code = r.read(), r.status
        except Exception as e:
            out, code = json.dumps({"error": f"{what} unreachable: {e}"}).encode(), 502
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def do_POST(self):
        if not self.path.startswith("/api/"):
            return self.send_error(404)
        n = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(min(n, 64_000))
        if self.path.startswith("/api/tts"):
            return self._forward(TTS + "/tts", body, "voices")
        try:
            req = urllib.request.Request(API + self.path, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                out, code = r.read(), r.status
        except Exception as e:
            out, code = json.dumps({"error": f"translator unreachable: {e}"}).encode(), 502
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, fmt, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    print(f"serving {ROOT} on http://0.0.0.0:{PORT}", flush=True)
    Server(("0.0.0.0", PORT), H).serve_forever()
