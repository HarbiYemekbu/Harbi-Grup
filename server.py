#!/usr/bin/env python3
"""Harbi Grup — iPhone ve Android'den açılır yerel sunucu."""

from __future__ import annotations

import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(__import__("os").environ.get("PORT", "4173"))
CANONICAL_HOST = "www.tolkanugur.com"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "[::1]"}


def _hostname(host_header: str) -> str:
    host = (host_header or "").split(",")[0].strip().lower()
    if host.startswith("["):
        end = host.find("]")
        return host[: end + 1] if end != -1 else host
    return host.split(":")[0]


def _is_local_host(host: str) -> bool:
    if host in LOCAL_HOSTS or host.endswith(".local"):
        return True
    parts = host.split(".")
    if len(parts) == 4 and all(p.isdigit() for p in parts):
        a, b = int(parts[0]), int(parts[1])
        return a == 10 or a == 127 or (a == 192 and b == 168) or (a == 172 and 16 <= b <= 31)
    return False


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".html": "text/html; charset=utf-8",
        ".woff2": "font/woff2",
    }

    def _redirect_canonical(self) -> bool:
        host = _hostname(self.headers.get("Host", ""))
        if _is_local_host(host) or host == CANONICAL_HOST:
            return False
        self.send_response(301)
        self.send_header("Location", f"https://{CANONICAL_HOST}{self.path}")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        return True

    def do_GET(self):
        if self._redirect_canonical():
            return
        super().do_GET()

    def do_HEAD(self):
        if self._redirect_canonical():
            return
        super().do_HEAD()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))


def lan_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


if __name__ == "__main__":
    host = "0.0.0.0"
    httpd = ThreadingHTTPServer((host, PORT), Handler)
    ip = lan_ip()
    print(f"Harbi Grup hazır")
    print(f"  Bilgisayar:  http://127.0.0.1:{PORT}/")
    print(f"  iPhone/Android (aynı Wi-Fi): http://{ip}:{PORT}/")
    print("Durdurmak için Ctrl+C")
    httpd.serve_forever()
