import { applyHit, emptyMonth, monthKey, publicMonth } from "./_lib/stats.js";

const ALLOWED = new Set([
  "home",
  "sell",
  "camera",
  "nfc",
  "music",
  "aiclip",
  "eimza",
  "notes",
  "hygiene",
  "harbiyemek",
  "flights",
  "holiday",
  "cars",
  "homes",
  "bikes",
  "pbx",
]);

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function kvOf(env) {
  return env?.HARBI_STATS || env?.STATS || null;
}

async function hashVisitor(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`harbi-vid:${text}`));
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function pastMonths(count) {
  const keys = [];
  let [year, month] = monthKey().split("-").map(Number);
  for (let i = 0; i < count; i += 1) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  return keys;
}

export async function onRequestPost(context) {
  const kv = kvOf(context.env);
  if (!kv) return json({ ok: false, ready: false });
  let body = {};
  try {
    body = await context.request.json();
  } catch {
    body = {};
  }
  const app = ALLOWED.has(body.app) ? body.app : "home";
  const visitor = await hashVisitor(body.vid);
  if (!visitor) return json({ ok: false, error: "vid" }, 400);
  const month = monthKey();
  const key = `month:${month}`;
  const row = applyHit((await kv.get(key, { type: "json" })) || emptyMonth(), visitor, app);
  await kv.put(key, JSON.stringify(row), { expirationTtl: 60 * 60 * 24 * 400 });
  return json({ ok: true, month });
}

export async function onRequestGet(context) {
  const kv = kvOf(context.env);
  const url = new URL(context.request.url);
  const want = url.searchParams.get("month") || monthKey();
  if (!kv) {
    return json({ ready: false, month: publicMonth(emptyMonth(), want), months: [] });
  }
  const keys = pastMonths(6);
  if (!keys.includes(want)) keys.unshift(want);
  const months = [];
  for (const key of keys) {
    const row = (await kv.get(`month:${key}`, { type: "json" })) || emptyMonth();
    months.push(publicMonth(row, key));
  }
  const current = months.find((item) => item.month === want) || months[0];
  return json({ ready: true, month: current, months });
}
