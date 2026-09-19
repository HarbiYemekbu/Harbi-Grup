function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function kvOf(env) {
  return env?.HARBI_STATS || env?.STATS || null;
}

function isLocalHost(host) {
  const h = String(host || "").toLowerCase();
  if (!h || h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1") return true;
  if (h.endsWith(".local")) return true;
  const parts = h.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
  }
  return false;
}

export function normalizeGsm(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("90") && d.length >= 12) d = d.slice(2);
  if (d.startsWith("0") && d.length >= 11) d = d.slice(1);
  return d;
}

function gsmOk(gsm) {
  return /^5\d{9}$/.test(gsm);
}

async function shaHex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function pepper(env) {
  return String(env.OTP_SECRET || env.MUSIC_INVOICE_SECRET || "harbi-otp");
}

async function hashCode(env, gsm, code) {
  return shaHex(`harbi-otp:${pepper(env)}:${gsm}:${code}`);
}

function randomCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, "0");
}

async function sendSms(env, gsm, text) {
  const user = String(env.NETGSM_USER || "").trim();
  const pass = String(env.NETGSM_PASS || "").trim();
  const header = String(env.NETGSM_HEADER || "").trim();
  if (user && pass && header) {
    const url = new URL("https://api.netgsm.com.tr/sms/send/get/");
    url.searchParams.set("usercode", user);
    url.searchParams.set("password", pass);
    url.searchParams.set("gsmno", "90" + gsm);
    url.searchParams.set("message", text);
    url.searchParams.set("msgheader", header);
    const res = await fetch(url.toString());
    const body = (await res.text()).trim();
    if (!body.startsWith("00")) {
      throw new Error("SMS gönderilemedi.");
    }
    return "netgsm";
  }
  const sid = String(env.TWILIO_ACCOUNT_SID || "").trim();
  const token = String(env.TWILIO_AUTH_TOKEN || "").trim();
  const from = String(env.TWILIO_FROM || "").trim();
  if (sid && token && from) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${sid}:${token}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: "+90" + gsm,
        From: from,
        Body: text,
      }),
    });
    if (!res.ok) throw new Error("SMS gönderilemedi.");
    return "twilio";
  }
  return "";
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const local = isLocalHost(new URL(request.url).hostname);
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const action = String(body.action || "send");
  const gsm = normalizeGsm(body.phone);
  if (!gsmOk(gsm)) return json({ ok: false, error: "Geçerli bir cep telefonu yazın." }, 400);

  const kv = kvOf(env);
  const mem = (globalThis.__yolOtp = globalThis.__yolOtp || {});
  const key = `otp:${gsm}`;
  const now = Date.now();
  const load = async () => {
    if (kv) return (await kv.get(key, { type: "json" })) || null;
    return mem[key] || null;
  };
  const save = async (row, ttlSec) => {
    if (kv) await kv.put(key, JSON.stringify(row), { expirationTtl: ttlSec });
    else mem[key] = row;
  };
  const drop = async () => {
    if (kv) await kv.delete(key);
    else delete mem[key];
  };

  if (action === "check") {
    const code = String(body.code || "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(code)) return json({ ok: false, error: "6 haneli kodu yazın." }, 400);
    const row = await load();
    if (!row || row.exp < now) {
      await drop();
      return json({ ok: false, error: "Kod süresi doldu. Yeni kod isteyin." }, 400);
    }
    const tries = Number(row.tries || 0) + 1;
    if (tries > 5) {
      await drop();
      return json({ ok: false, error: "Çok fazla deneme. Yeni kod isteyin." }, 400);
    }
    const expect = await hashCode(env, gsm, code);
    if (expect !== row.hash) {
      row.tries = tries;
      await save(row, Math.max(60, Math.ceil((row.exp - now) / 1000)));
      return json({ ok: false, error: "Kod hatalı." }, 400);
    }
    await drop();
    return json({ ok: true, verified: true, phone: gsm });
  }

  const row = (await load()) || {};
  if (row.sentAt && now - row.sentAt < 60000) {
    return json({ ok: false, error: "Yeni kod için bir dakika bekleyin." }, 429);
  }
  const hourSends = (row.sends || []).filter((t) => now - t < 3600000);
  if (hourSends.length >= 5) {
    return json({ ok: false, error: "Bu numaraya çok kod gönderildi. Daha sonra deneyin." }, 429);
  }
  const code = randomCode();
  const hash = await hashCode(env, gsm, code);
  const next = {
    hash,
    exp: now + 5 * 60 * 1000,
    tries: 0,
    sentAt: now,
    sends: [...hourSends, now],
  };
  let via = "";
  try {
    via = await sendSms(env, gsm, `Harbi Yol dogrulama kodu: ${code}`);
  } catch {
    return json({ ok: false, error: "SMS gönderilemedi. Daha sonra deneyin." }, 502);
  }
  if (!via && !local) {
    return json(
      { ok: false, error: "SMS servisi bağlı değil. Cloudflare’da NETGSM veya Twilio anahtarları gerekir." },
      503
    );
  }
  await save(next, 600);
  const out = { ok: true, sent: true, phone: gsm };
  if (local && !via) out.devCode = code;
  return json(out);
}

export async function onRequestGet() {
  return json({ ok: false, error: "POST" }, 405);
}
