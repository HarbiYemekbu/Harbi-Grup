const INIT_PATH = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
const RETRIEVE_PATH = "/payment/iyzipos/checkoutform/auth/ecom/detail";

function sandboxOn(env) {
  return String(env.IYZICO_SANDBOX || "") === "1";
}

export function iyzicoConfigured(env) {
  return Boolean(env.IYZICO_API_KEY && env.IYZICO_SECRET_KEY);
}

export function iyzicoBase(env) {
  if (env.IYZICO_BASE_URL) return String(env.IYZICO_BASE_URL).replace(/\/$/, "");
  return sandboxOn(env) ? "https://sandbox-api.iyzipay.com" : "https://api.iyzipay.com";
}

function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authorization(apiKey, secretKey, uriPath, body, randomKey) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(randomKey + uriPath + body)
  );
  const packed =
    "apiKey:" + apiKey + "&randomKey:" + randomKey + "&signature:" + bytesToHex(sig);
  return "IYZWSv2 " + btoa(packed);
}

export async function iyzicoPost(env, uriPath, payload) {
  const apiKey = env.IYZICO_API_KEY;
  const secretKey = env.IYZICO_SECRET_KEY;
  if (!apiKey || !secretKey) {
    return { ok: false, status: 503, data: { errorMessage: "iyzico anahtarları tanımlı değil." } };
  }
  const body = JSON.stringify(payload);
  const randomKey = Date.now().toString() + "HarbiGrup";
  const auth = await authorization(apiKey, secretKey, uriPath, body, randomKey);
  const res = await fetch(iyzicoBase(env) + uriPath, {
    method: "POST",
    headers: {
      Authorization: auth,
      "x-iyzi-rnd": randomKey,
      "Content-Type": "application/json",
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.status === "success", status: res.status, data };
}

export function moneyText(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0.5 || n > 250000) return "";
  return n.toFixed(2);
}

export function splitName(full) {
  const parts = String(full || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    name: parts[0] || "Uye",
    surname: parts.slice(1).join(" ") || "Hesap",
  };
}

export function gsmNumber(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) return "+90" + d;
  if (d.length === 11 && d.startsWith("0")) return "+90" + d.slice(1);
  if (d.length === 12 && d.startsWith("90")) return "+" + d;
  if (d.length >= 10) return "+90" + d.slice(-10);
  return "+905555555555";
}

export function identityNumber(raw, env) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 11) return d;
  return sandboxOn(env) ? "74300864791" : "11111111110";
}

export function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "127.0.0.1"
  );
}

export function originOf(request) {
  const url = new URL(request.url);
  return url.origin;
}

export { INIT_PATH, RETRIEVE_PATH };
