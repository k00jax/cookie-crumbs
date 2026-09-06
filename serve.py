#!/usr/bin/env python3
"""Static server for CHIP out/ — SimpleHTTPRequestHandler semantics (serves .html as-is,
no extension stripping) plus cache headers: immutable for hashed /_next/static assets,
no-cache for HTML so new builds pick up instantly."""
import http.server
import os

ROOT = "/home/odroid/builds/cookie-crumbs/out"


class ChipHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        path = self.path.split("?")[0]
        if path.startswith("/_next/static/"):
            # hashed filenames: safe to cache forever
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        elif path.endswith("/") or path.endswith(".html"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):  # quieter logs
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8095"))
    http.server.ThreadingHTTPServer(("0.0.0.0", port), ChipHandler).serve_forever()
