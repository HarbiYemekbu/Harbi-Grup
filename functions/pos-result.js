import { RETRIEVE_PATH, iyzicoConfigured, iyzicoPost } from "./_lib/iyzico.js";

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!iyzicoConfigured(env)) {
    return Response.json({ ok: false, error: "iyzico bağlı değil." }, { status: 503 });
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "İstek okunamadı." }, { status: 400 });
  }
  const token = String(body.token || "").trim();
  if (!token) {
    return Response.json({ ok: false, error: "Ödeme jetonu yok." }, { status: 400 });
  }
  const result = await iyzicoPost(env, RETRIEVE_PATH, {
    locale: "tr",
    conversationId: "pos_result",
    token,
  });
  const data = result.data || {};
  const success =
    result.ok &&
    String(data.paymentStatus || "").toUpperCase() === "SUCCESS" &&
    Number(data.fraudStatus) !== -1;
  return Response.json({
    ok: success,
    paymentStatus: data.paymentStatus || "",
    paymentId: data.paymentId || "",
    paidPrice: data.paidPrice || data.price || "",
    lastFourDigits: data.lastFourDigits || "",
    cardAssociation: data.cardAssociation || "",
    error: success ? "" : data.errorMessage || "Ödeme tamamlanmadı.",
  });
}
