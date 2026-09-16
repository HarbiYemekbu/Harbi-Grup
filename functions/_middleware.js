const CANONICAL_HOST = "www.tolkanugur.com";

function isLocalHost(host) {
  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1") {
    return true;
  }
  if (host.endsWith(".local")) return true;
  const parts = host.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
  }
  return false;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();
  if (isLocalHost(host)) return context.next();
  if (host === CANONICAL_HOST && url.protocol === "https:") return context.next();
  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return Response.redirect(url.toString(), 301);
}
