export async function onRequestPost(context) {
  const { request } = context;
  const ctype = request.headers.get("Content-Type") || "";
  let token = "";
  if (ctype.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    token = String(body.token || "");
  } else {
    const text = await request.text();
    token = String(new URLSearchParams(text).get("token") || "");
  }
  const origin = new URL(request.url).origin;
  const loc = origin + "/?posToken=" + encodeURIComponent(token);
  return Response.redirect(loc, 303);
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const token = url.searchParams.get("token") || "";
  const loc = url.origin + "/?posToken=" + encodeURIComponent(token);
  return Response.redirect(loc, 302);
}
