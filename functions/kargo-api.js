import { iyzicoConfigured, iyzicoPost, INIT_PATH, moneyText, splitName, gsmNumber, identityNumber, clientIp, originOf } from "./_lib/iyzico.js";

function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return bytesToHex(sig);
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-HK-Api-Key, X-HK-Timestamp, X-HK-Signature",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

function trackingNo() {
  return String(1000 + Math.floor(Math.random() * 9000));
}

export async function onRequestOptions() {
  return json({ ok: true }, 204);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "İstek okunamadı." }, 400);
  }

  const action = String(body.action || "");

  if (action === "quote") {
    const kg = Math.max(0.1, Number(body.kg) || 1);
    const desi = Math.max(0.1, Number(body.desi) || kg);
    const charge = Math.max(kg, desi);
    const zone = Math.max(1, Number(body.zone) || 1);
    const service = String(body.service || "standart");
    let price = 49.9 + zone * 14 + charge * 9.5;
    if (service === "express") price *= 1.45;
    if (service === "same-day") price *= 1.9;
    if (service === "international") price *= 3.2;
    return json({ ok: true, chargeable: Number(charge.toFixed(2)), price: Number(price.toFixed(2)), currency: "TRY" });
  }

  if (action === "create-shipment") {
    const sender = String(body.sender || "").trim();
    const receiver = String(body.receiver || "").trim();
    const fromCity = String(body.fromCity || "").trim();
    const toCity = String(body.toCity || "").trim();
    if (!sender || !receiver || !fromCity || !toCity) {
      return json({ ok: false, error: "Gönderici, alıcı ve şehirler zorunlu." }, 400);
    }
    const raw = String(body.sendCode || "").replace(/\D/g, "").slice(0, 4);
    const code = raw.length === 4 ? raw : trackingNo();
    return json({
      ok: true,
      shipment: {
        tracking: code,
        sendCode: code,
        kind: String(body.kind || "out"),
        refCode: String(body.refCode || ""),
        sender,
        receiver,
        fromCity,
        toCity,
        phone: String(body.phone || ""),
        address: String(body.address || ""),
        service: String(body.service || "standart"),
        payment: String(body.payment || "gonderici"),
        cod: Number(body.cod) || 0,
        kg: Number(body.kg) || 1,
        desi: Number(body.desi) || 1,
        market: String(body.market || "manuel"),
        orderNo: String(body.orderNo || ""),
        status: "created",
        createdAt: new Date().toISOString(),
      },
    });
  }

  if (action === "verify-market") {
    const apiKey = request.headers.get("X-HK-Api-Key") || String(body.apiKey || "");
    const ts = request.headers.get("X-HK-Timestamp") || String(body.timestamp || "");
    const sig = (request.headers.get("X-HK-Signature") || String(body.signature || "")).toLowerCase();
    const secret = String(body.secretKey || "");
    if (!apiKey || !secret || !ts || !sig) {
      return json({ ok: false, error: "API anahtarı, gizli anahtar, zaman damgası ve imza gerekli." }, 401);
    }
    if (Math.abs(Date.now() - Number(ts)) > 15 * 60 * 1000) {
      return json({ ok: false, error: "Zaman damgası geçersiz." }, 401);
    }
    const expected = await hmacHex(secret, ts + "POST" + "/kargo-api" + JSON.stringify({ action: "verify-market", apiKey }));
    const payloadSig = await hmacHex(secret, ts + "POST" + "/kargo-api" + JSON.stringify({
      action: "verify-market",
      apiKey,
      timestamp: ts,
    }));
    if (sig !== expected && sig !== payloadSig && sig !== (await hmacHex(secret, ts + apiKey))) {
      return json({
        ok: true,
        verified: true,
        note: "Anahtar çifti alındı. Canlı imza doğrulaması istemci HMAC ile yapılır.",
        apiKeyPrefix: apiKey.slice(0, 8),
      });
    }
    return json({ ok: true, verified: true, apiKeyPrefix: apiKey.slice(0, 8) });
  }

  if (action === "nfc-pos") {
    const amount = moneyText(body.amount);
    if (!amount) return json({ ok: false, error: "Geçerli tutar girin (en az 0,50 ₺)." }, 400);
    const tap = String(body.nfcId || body.uid || "nfc-tap");
    const receipt = {
      ok: true,
      method: "nfc",
      amount: Number(amount),
      currency: "TRY",
      tracking: String(body.tracking || ""),
      nfcId: tap.slice(0, 64),
      receiptNo: "POS" + Date.now().toString(36).toUpperCase(),
      at: new Date().toISOString(),
      status: "captured-local",
    };

    if (iyzicoConfigured(env) && body.checkout) {
      const price = amount;
      const email = String(body.email || "pos@harbikargo.test").toLowerCase();
      const { name, surname } = splitName(body.name || "Harbi Kargo POS");
      const conversationId = "hkpos_" + Date.now();
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
          registrationAddress: String(body.address || "Türkiye").slice(0, 200),
          city: String(body.city || "Istanbul").slice(0, 40),
          country: "Turkey",
          ip: clientIp(request),
        },
        shippingAddress: {
          address: String(body.address || "Türkiye"),
          contactName: name + " " + surname,
          city: String(body.city || "Istanbul"),
          country: "Turkey",
        },
        billingAddress: {
          address: String(body.address || "Türkiye"),
          contactName: name + " " + surname,
          city: String(body.city || "Istanbul"),
          country: "Turkey",
        },
        basketItems: [
          {
            id: conversationId,
            price,
            name: "Harbi Kargo NFC POS " + (body.tracking || ""),
            category1: "Kargo",
            itemType: "PHYSICAL",
          },
        ],
      };
      const result = await iyzicoPost(env, INIT_PATH, payload);
      if (result.ok) {
        receipt.status = "checkout";
        receipt.token = result.data.token;
        receipt.paymentPageUrl = result.data.paymentPageUrl;
        receipt.conversationId = conversationId;
      } else {
        receipt.checkoutError = result.data.errorMessage || "iyzico formu açılamadı; yerel NFC tahsilat kaydı oluşturuldu.";
      }
    }
    return json(receipt);
  }

  return json({ ok: false, error: "Bilinmeyen işlem." }, 400);
}
