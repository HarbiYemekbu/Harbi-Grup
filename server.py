#!/usr/bin/env python3
"""Harbi Grup — iPhone ve Android'den açılır yerel sunucu."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import socket
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime
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
_otp_lock = threading.Lock()
_otp_store = {}


def _gsm(raw: str) -> str:
    d = "".join(ch for ch in str(raw or "") if ch.isdigit())
    if d.startswith("90") and len(d) >= 12:
        d = d[2:]
    if d.startswith("0") and len(d) >= 11:
        d = d[1:]
    return d


def _otp_hash(gsm: str, code: str) -> str:
    secret = os.environ.get("OTP_SECRET") or os.environ.get("MUSIC_INVOICE_SECRET") or "harbi-otp"
    return hashlib.sha256(f"harbi-otp:{secret}:{gsm}:{code}".encode("utf-8")).hexdigest()


def _otp_send_sms(gsm: str, code: str) -> str:
    user = (os.environ.get("NETGSM_USER") or "").strip()
    password = (os.environ.get("NETGSM_PASS") or "").strip()
    header = (os.environ.get("NETGSM_HEADER") or "").strip()
    text = f"Harbi Yol dogrulama kodu: {code}"
    if user and password and header:
        qs = urllib.parse.urlencode(
            {
                "usercode": user,
                "password": password,
                "gsmno": "90" + gsm,
                "message": text,
                "msgheader": header,
            }
        )
        with urllib.request.urlopen("https://api.netgsm.com.tr/sms/send/get/?" + qs, timeout=20) as res:
            body = res.read().decode("utf-8", "ignore").strip()
        if not body.startswith("00"):
            raise RuntimeError("sms")
        return "netgsm"
    return ""


def _phone_otp(body: dict) -> tuple[int, dict]:
    action = str(body.get("action") or "send")
    gsm = _gsm(body.get("phone"))
    if len(gsm) != 10 or not gsm.startswith("5"):
        return 400, {"ok": False, "error": "Geçerli bir cep telefonu yazın."}
    now = time.time()
    with _otp_lock:
        row = _otp_store.get(gsm)
        if action == "check":
            code = "".join(ch for ch in str(body.get("code") or "") if ch.isdigit())
            if len(code) != 6:
                return 400, {"ok": False, "error": "6 haneli kodu yazın."}
            if not row or float(row.get("exp") or 0) < now:
                _otp_store.pop(gsm, None)
                return 400, {"ok": False, "error": "Kod süresi doldu. Yeni kod isteyin."}
            tries = int(row.get("tries") or 0) + 1
            if tries > 5:
                _otp_store.pop(gsm, None)
                return 400, {"ok": False, "error": "Çok fazla deneme. Yeni kod isteyin."}
            if _otp_hash(gsm, code) != row.get("hash"):
                row["tries"] = tries
                return 400, {"ok": False, "error": "Kod hatalı."}
            _otp_store.pop(gsm, None)
            return 200, {"ok": True, "verified": True, "phone": gsm}
        if row and now - float(row.get("sentAt") or 0) < 60:
            return 429, {"ok": False, "error": "Yeni kod için bir dakika bekleyin."}
        sends = [t for t in ((row or {}).get("sends") or []) if now - t < 3600]
        if len(sends) >= 5:
            return 429, {"ok": False, "error": "Bu numaraya çok kod gönderildi. Daha sonra deneyin."}
        code = f"{int.from_bytes(os.urandom(3), 'big') % 1000000:06d}"
        via = ""
        try:
            via = _otp_send_sms(gsm, code)
        except Exception:
            return 502, {"ok": False, "error": "SMS gönderilemedi. Daha sonra deneyin."}
        _otp_store[gsm] = {
            "hash": _otp_hash(gsm, code),
            "exp": now + 300,
            "tries": 0,
            "sentAt": now,
            "sends": sends + [now],
        }
    out = {"ok": True, "sent": True, "phone": gsm}
    if not via:
        out["devCode"] = code
    return 200, out
_invoices = {}
_invoice_lock = threading.Lock()


def _hmac_hex(text: str) -> str:
    return hmac.new(_INVOICE_SECRET.encode("utf-8"), text.encode("utf-8"), hashlib.sha256).hexdigest()


def _music_vat(gross: float) -> dict:
    net = round(gross / 1.2, 2)
    vat = round(gross - net, 2)
    return {"gross": gross, "net": net, "vat": vat, "rate": 20}


def _mint_invoice(plan: str, kind: str = "music") -> str:
    year = str(datetime.now().year)
    stamp = str(int(time.time()) % 1000000).zfill(6)
    code = "2" if plan == "year" else "1"
    prefix = "HGC" if kind == "clip" else "HGB"
    base = prefix + year + stamp + code
    check = str(int(_hmac_hex(base)[:4], 16) % 100).zfill(2)
    return (base + check)[:16]


def _invoice_token(number: str, email: str, amount: float, plan: str) -> str:
    return _hmac_hex("|".join([number, email, str(amount), plan]))


def _music_invoice(body: dict) -> tuple[int, dict]:
    first = str(body.get("first") or "").strip()
    last = str(body.get("last") or "").strip()
    phone = "".join(ch for ch in str(body.get("phone") or "") if ch.isdigit())
    email = str(body.get("email") or "").strip().lower()
    address = str(body.get("address") or "").strip()
    plan = "year" if body.get("plan") == "year" else "month"
    kind = "clip" if body.get("kind") == "clip" else "music"
    amount = 750.0 if plan == "year" else 49.0
    if len(first) < 2 or len(last) < 2:
        return 400, {"ok": False, "error": "İsim ve soy isim zorunlu."}
    if len(phone) < 10:
        return 400, {"ok": False, "error": "Geçerli telefon yazın."}
    if "@" not in email or "." not in email.split("@")[-1]:
        return 400, {"ok": False, "error": "Fatura için geçerli e-posta yazın."}
    if len(address) < 10:
        return 400, {"ok": False, "error": "Adres zorunlu."}
    if plan == "month" and not str(body.get("dekontName") or "").strip():
        return 400, {"ok": False, "error": "Aylık havale için dekont zorunlu."}
    vat = _music_vat(amount)
    number = _mint_invoice(plan, kind)
    token = _invoice_token(number, email, amount, plan)
    with _invoice_lock:
        _invoices[number] = {
            "email": email,
            "plan": plan,
            "amount": amount,
            "kind": kind,
            "token": token,
            "at": time.time(),
        }
    print("e-fatura", kind, number, "→", email, "KDV %20", vat)
    return 200, {
        "ok": True,
        "pending": True,
        "invoiceNumber": number,
        "token": token,
        "vat": vat,
        "mailed": False,
        "trendyol": False,
        "trendyolReady": False,
        "mailReady": False,
        "message": "Yerel deneme: fatura kesildi. Canlıda e-fatura ve e-posta Cloudflare anahtarlarıyla gider. Üyelik süreci inceleniyor.",
    }


def _music_invoice_check(body: dict) -> tuple[int, dict]:
    number = str(body.get("invoiceNumber") or "").upper().replace(" ", "")
    email = str(body.get("email") or "").strip().lower()
    plan = "year" if body.get("plan") == "year" else "month"
    amount = 750.0 if plan == "year" else 49.0
    token = str(body.get("token") or "").lower()
    expect = _invoice_token(number, email, amount, plan)
    with _invoice_lock:
        stored = _invoices.get(number)
    if token != expect and not (stored and stored.get("token") == token):
        return 400, {"ok": False, "error": "Fatura numarası doğrulanamadı. Maildeki numarayı yazın."}
    return 200, {
        "ok": True,
        "invoiceNumber": number,
        "until": int(time.time() * 1000) + (365 if plan == "year" else 30) * 86400000,
        "message": "Fatura doğrulandı. Aboneliğiniz aktif.",
    }


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
        if path in {"/pos-pay", "/pos-result", "/pos-callback"}:
            self._json(
                503,
                {
                    "ok": False,
                    "error": "iyzico yerel sunucuda çalışmaz. Canlı sitede Cloudflare IYZICO_API_KEY ve IYZICO_SECRET_KEY gerekir.",
                },
            )
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
        if path == "/music-invoice":
            code, payload = _music_invoice(body)
            self._json(code, payload)
            return
        if path == "/music-invoice-check":
            code, payload = _music_invoice_check(body)
            self._json(code, payload)
            return
        if path == "/phone-otp":
            code, payload = _phone_otp(body)
            self._json(code, payload)
            return
        if path != "/pbx-rtc":
            self.send_error(404)
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
