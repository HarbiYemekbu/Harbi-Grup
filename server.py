#!/usr/bin/env python3
"""Harbi Grup — iPhone ve Android'den açılır yerel sunucu."""

from __future__ import annotations

import json
import socket
import threading
import time
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(__import__("os").environ.get("PORT", "4173"))
CANONICAL_HOST = "www.tolkanugur.com"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "[::1]"}

_rtc_lock = threading.Lock()
_rtc_presence = {}
_rtc_inbox = {}
_RTC_TTL = 18


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


def _rtc_purge(now: float) -> None:
    dead = []
    for org, peers in list(_rtc_presence.items()):
        for peer, info in list(peers.items()):
            if now - float(info.get("ts") or 0) > _RTC_TTL:
                peers.pop(peer, None)
                dead.append(peer)
        if not peers:
            _rtc_presence.pop(org, None)
    for peer in dead:
        _rtc_inbox.pop(peer, None)


def _rtc_handle(body: dict) -> dict:
    now = time.time()
    action = str(body.get("action") or "hello")
    org = str(body.get("org") or "")[:80]
    peer = str(body.get("peer") or "")[:80]
    if not org or not peer:
        return {"ok": False, "error": "org"}
    with _rtc_lock:
        _rtc_purge(now)
        if action == "bye":
            if org in _rtc_presence:
                _rtc_presence[org].pop(peer, None)
            _rtc_inbox.pop(peer, None)
            to = str(body.get("to") or "")[:80]
            if to:
                _rtc_inbox.setdefault(to, []).append(
                    {"from": peer, "type": "bye", "payload": {}, "ts": now}
                )
            return {"ok": True, "peers": [], "messages": []}
        if action == "send":
            to = str(body.get("to") or "")[:80]
            kind = str(body.get("type") or "")[:20]
            if to and kind:
                box = _rtc_inbox.setdefault(to, [])
                box.append(
                    {
                        "from": peer,
                        "type": kind,
                        "payload": body.get("payload") if isinstance(body.get("payload"), dict) else {},
                        "ts": now,
                    }
                )
                _rtc_inbox[to] = box[-40:]
            return {"ok": True}
        peers = _rtc_presence.setdefault(org, {})
        peers[peer] = {
            "peer": peer,
            "ext": str(body.get("ext") or "")[:12],
            "name": str(body.get("name") or "")[:40],
            "ts": now,
        }
        others = [dict(item) for pid, item in peers.items() if pid != peer]
        messages = _rtc_inbox.pop(peer, [])
        return {"ok": True, "peers": others, "messages": messages}


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

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, payload: dict) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self._cors()
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path != "/pbx-rtc":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            length = 0
        if length > 200_000:
            self._json(413, {"ok": False, "error": "size"})
            return
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
            if not isinstance(body, dict):
                raise ValueError("json")
        except Exception:
            self._json(400, {"ok": False, "error": "json"})
            return
        self._json(200, _rtc_handle(body))

    def do_GET(self):
        if self._redirect_canonical():
            return
        path = urllib.parse.urlparse(self.path).path
        if path == "/pbx-rtc":
            self._json(405, {"ok": False, "error": "POST"})
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
