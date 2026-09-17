import {
  invoiceToken,
  mailConfigured,
  mintInvoiceNumber,
  musicVat,
  sendInvoiceMail,
  trendyolConfigured,
  trendyolCreateInvoice,
} from "./_lib/music-invoice.js";

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

  const first = String(body.first || "").trim();
  const last = String(body.last || "").trim();
  const phone = String(body.phone || "").replace(/\D/g, "");
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const address = String(body.address || "").trim();
  const plan = body.plan === "year" ? "year" : "month";
  const kind = body.kind === "clip" ? "clip" : "music";
  const amount = plan === "year" ? 750 : 49;
  if (first.length < 2 || last.length < 2) {
    return Response.json({ ok: false, error: "İsim ve soy isim zorunlu." }, { status: 400 });
  }
  if (phone.length < 10) {
    return Response.json({ ok: false, error: "Geçerli telefon yazın." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ ok: false, error: "Fatura için geçerli e-posta yazın." }, { status: 400 });
  }
  if (address.length < 10) {
    return Response.json({ ok: false, error: "Adres zorunlu." }, { status: 400 });
  }
  if (plan === "month" && !body.dekontName) {
    return Response.json({ ok: false, error: "Aylık havale için dekont zorunlu." }, { status: 400 });
  }

  const vat = musicVat(amount);
  const minted = await mintInvoiceNumber(plan, env, kind);
  const ty = await trendyolCreateInvoice(env, { ...body, first, last, phone, email, address, plan, kind }, vat, minted);
  const invoiceNumber = ty.invoiceNumber || minted;
  const mail = await sendInvoiceMail(env, { first, last, email, plan, kind }, vat, invoiceNumber, ty.ok);
  const token = await invoiceToken(invoiceNumber, email, amount, plan, env);

  return Response.json({
    ok: true,
    pending: true,
    invoiceNumber,
    token,
    vat,
    mailed: mail.ok,
    trendyol: ty.ok,
    trendyolReady: trendyolConfigured(env),
    mailReady: mailConfigured(env),
    message: mail.ok
      ? "e-Fatura oluştu ve e-postanıza gönderildi. Üyelik süreci inceleniyor."
      : "e-Fatura kaydı oluştu. E-posta için Cloudflare’a RESEND_API_KEY ekleyin. Fatura numaranızla üyeliği aktif edebilirsiniz.",
  });
}
