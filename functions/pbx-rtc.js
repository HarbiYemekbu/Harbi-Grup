const STORE = "https://pbx-rtc.harbi/state";
const TTL = 18;

function purge(state, now) {
  const dead = [];
  for (const [org, peers] of Object.entries(state.presence || {})) {
    for (const [peer, info] of Object.entries(peers)) {
      if (now - Number(info?.ts || 0) > TTL) {
        delete peers[peer];
        dead.push(peer);
      }
    }
    if (!Object.keys(peers).length) delete state.presence[org];
  }
  for (const peer of dead) delete state.inbox[peer];
}

function handle(state, body) {
  const now = Date.now() / 1000;
  const action = String(body.action || "hello");
  const org = String(body.org || "").slice(0, 80);
  const peer = String(body.peer || "").slice(0, 80);
  if (!org || !peer) return { ok: false, error: "org" };
  state.presence = state.presence || {};
  state.inbox = state.inbox || {};
  purge(state, now);
  if (action === "bye") {
    if (state.presence[org]) delete state.presence[org][peer];
    delete state.inbox[peer];
    const to = String(body.to || "").slice(0, 80);
    if (to) {
      state.inbox[to] = state.inbox[to] || [];
      state.inbox[to].push({ from: peer, type: "bye", payload: {}, ts: now });
    }
    return { ok: true, peers: [], messages: [] };
  }
  if (action === "send") {
    const to = String(body.to || "").slice(0, 80);
    const kind = String(body.type || "").slice(0, 20);
    if (to && kind) {
      const box = state.inbox[to] || [];
      box.push({
        from: peer,
        type: kind,
        payload: body.payload && typeof body.payload === "object" ? body.payload : {},
        ts: now,
      });
      state.inbox[to] = box.slice(-40);
    }
    return { ok: true };
  }
  const peers = state.presence[org] || {};
  peers[peer] = {
    peer,
    ext: String(body.ext || "").slice(0, 12),
    name: String(body.name || "").slice(0, 40),
    ts: now,
  };
  state.presence[org] = peers;
  const others = Object.entries(peers)
    .filter(([id]) => id !== peer)
    .map(([, item]) => item);
  const messages = state.inbox[peer] || [];
  delete state.inbox[peer];
  return { ok: true, peers: others, messages };
}

async function withState(fn) {
  const cache = caches.default;
  const hit = await cache.match(STORE);
  const state = hit ? await hit.json().catch(() => ({ presence: {}, inbox: {} })) : { presence: {}, inbox: {} };
  const result = fn(state);
  await cache.put(
    STORE,
    new Response(JSON.stringify(state), {
      headers: { "Content-Type": "application/json", "Cache-Control": "max-age=60" },
    })
  );
  return result;
}

export async function onRequestPost(context) {
  let body = {};
  try {
    body = await context.request.json();
    if (!body || typeof body !== "object") throw new Error("json");
  } catch {
    return Response.json({ ok: false, error: "json" }, { status: 400 });
  }
  const payload = await withState((state) => handle(state, body));
  const status = payload.ok ? 200 : 400;
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestGet() {
  return Response.json({ ok: false, error: "POST" }, { status: 405 });
}
