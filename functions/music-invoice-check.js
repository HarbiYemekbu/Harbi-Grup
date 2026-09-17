import { invoiceTokenValid, trendyolFindInvoice } from "./_lib/music-invoice.js";

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
  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "İstek okunamadı." }, { status: 400 });
  }

  const invoiceNumber = String(body.invoiceNumber || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  const plan = body.plan === "year" ? "year" : "month";
  const amount = plan === "year" ? 750 : 49;
  const email = String(body.email || "")
    .trim()
    .toLowerCase();

  const signed = await invoiceTokenValid({ ...body, invoiceNumber, plan, amount, email }, env);
  const remote = await trendyolFindInvoice(env, invoiceNumber);
  if (!signed && !remote.ok) {
    return Response.json(
      { ok: false, error: "Fatura numarası doğrulanamadı. Maildeki numarayı yazın." },
      { status: 400 }
    );
  }

  return Response.json({
    ok: true,
    invoiceNumber,
    until: Date.now() + (plan === "year" ? 365 : 30) * 86400000,
    message: "Fatura doğrulandı. Aboneliğiniz aktif.",
  });
}
