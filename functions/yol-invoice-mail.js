function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

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

function mailConfigured(env) {
  return Boolean(env?.RESEND_API_KEY && (env.MUSIC_MAIL_FROM || env.RESEND_FROM || env.YOL_MAIL_FROM));
}

export async function onRequestPost({ request, env }) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "İstek okunamadı." }, 400);
  }
  const to = String(body.email || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return json({ ok: false, error: "Müşteri e-posta adresi geçersiz." }, 400);
  }
  const filename = String(body.filename || "fatura.pdf").replace(/[^\w.\-ğüşıöçĞÜŞİÖÇ ]+/g, "").slice(0, 80) || "fatura.pdf";
  const content = String(body.content || "").replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  if (!content || content.length < 80) {
    return json({ ok: false, error: "Fatura dosyası eksik." }, 400);
  }
  if (content.length > 7 * 1024 * 1024) {
    return json({ ok: false, error: "Dosya en fazla 5 MB olabilir." }, 400);
  }
  if (!mailConfigured(env)) {
    return json({
      ok: false,
      skipped: true,
      error: "E-posta için canlı sitede RESEND_API_KEY gerekir. Fatura kaydı oluştu.",
    });
  }
  const from = String(env.YOL_MAIL_FROM || env.MUSIC_MAIL_FROM || env.RESEND_FROM);
  const seller = String(body.seller || "Harbi satıcı").slice(0, 80);
  const orderNo = String(body.orderNo || body.number || "").slice(0, 40);
  const buyer = String(body.buyer || "Müşteri").slice(0, 80);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Harbi faturanız" + (orderNo ? " · " + orderNo : ""),
      html: `<p>Merhaba ${buyer},</p>
<p>${seller} satışınız için faturanız ektedir.</p>
<p>Bu ileti Harbi satıcı paneli üzerinden gönderildi.</p>`,
      attachments: [
        {
          filename,
          content,
        },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return json({ ok: false, error: data.message || "Fatura e-postası gönderilemedi." }, 502);
  }
  return json({ ok: true });
}
