import {
  INIT_PATH,
  clientIp,
  gsmNumber,
  identityNumber,
  iyzicoConfigured,
  iyzicoPost,
  moneyText,
  originOf,
  splitName,
} from "./_lib/iyzico.js";

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
    return Response.json(
      {
        ok: false,
        error:
          "iyzico bağlı değil. Cloudflare’da IYZICO_API_KEY ve IYZICO_SECRET_KEY tanımlayın.",
      },
      { status: 503 }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "İstek okunamadı." }, { status: 400 });
  }

  const price = moneyText(body.amount);
  if (!price) {
    return Response.json({ ok: false, error: "Geçerli tutar girin (en az 0,50 ₺)." }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ ok: false, error: "Geçerli e-posta gerekli." }, { status: 400 });
  }

  const { name, surname } = splitName(body.name);
  const address = String(body.address || "Türkiye").slice(0, 200);
  const city = String(body.city || "Istanbul").slice(0, 40);
  const note = String(body.note || "Sanal POS tahsilat").slice(0, 80);
  const conversationId = "pos_" + Date.now();
  const origin = originOf(request);
  const payload = {
    locale: "tr",
    conversationId,
    price,
    paidPrice: price,
    currency: "TRY",
    basketId: conversationId,
    paymentGroup: "PRODUCT",
    callbackUrl: origin + "/pos-callback",
    enabledInstallments: [1],
    buyer: {
      id: String(body.phone || conversationId).replace(/\D/g, "").slice(-11) || conversationId,
      name,
      surname,
      identityNumber: identityNumber(body.identityNumber, env),
      email,
      gsmNumber: gsmNumber(body.phone),
      registrationAddress: address,
      city,
      country: "Turkey",
      ip: clientIp(request),
    },
    shippingAddress: {
      address,
      contactName: name + " " + surname,
      city,
      country: "Turkey",
    },
    billingAddress: {
      address,
      contactName: name + " " + surname,
      city,
      country: "Turkey",
    },
    basketItems: [
      {
        id: conversationId,
        price,
        name: note || "Harbi Grup Sanal POS",
        category1: "Sanal POS",
        itemType: "VIRTUAL",
      },
    ],
  };

  const result = await iyzicoPost(env, INIT_PATH, payload);
  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        error: result.data.errorMessage || result.data.errorCode || "iyzico ödeme formu açılamadı.",
      },
      { status: 400 }
    );
  }

  return Response.json({
    ok: true,
    token: result.data.token,
    paymentPageUrl: result.data.paymentPageUrl,
    conversationId,
  });
}
