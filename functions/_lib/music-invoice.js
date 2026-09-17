const VAT_RATE = 0.2;

function productKind(body) {
  return body && body.kind === "clip" ? "clip" : "music";
}

function invoicePrefix(kind) {
  return kind === "clip" ? "HGC" : "HGB";
}

function productTitle(kind) {
  return kind === "clip" ? "Yapay Zeka İle Klip Yap" : "Müzik Veya Şarkı Yap";
}

function enc(text) {
  return new TextEncoder().encode(text);
}

export function musicVat(gross) {
  const g = Math.round(Number(gross) * 100) / 100;
  const net = Math.round((g / (1 + VAT_RATE)) * 100) / 100;
  const vat = Math.round((g - net) * 100) / 100;
  return { gross: g, net, vat, rate: 20 };
}

export function invoiceSecret(env) {
  return String(env.MUSIC_INVOICE_SECRET || env.TRENDYOL_API_SECRET || env.IYZICO_SECRET_KEY || "");
}

export async function hmacHex(secret, text) {
  const key = await crypto.subtle.importKey("raw", enc(secret || "x"), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function trendyolConfigured(env) {
  return Boolean(env.TRENDYOL_API_KEY && env.TRENDYOL_API_SECRET && env.TRENDYOL_SELLER_ID);
}

export function mailConfigured(env) {
  return Boolean(env.RESEND_API_KEY && (env.MUSIC_MAIL_FROM || env.RESEND_FROM));
}

function planCode(plan) {
  return plan === "year" ? "2" : "1";
}

export async function mintInvoiceNumber(plan, env, kind) {
  const year = String(new Date().getFullYear());
  const stamp = String(Math.floor(Date.now() / 1000) % 1000000).padStart(6, "0");
  const base = invoicePrefix(kind) + year + stamp + planCode(plan);
  const digest = await hmacHex(invoiceSecret(env), base);
  const check = String(parseInt(digest.slice(0, 4), 16) % 100).padStart(2, "0");
  return (base + check).slice(0, 16);
}

export async function invoiceNumberValid(number, plan, env) {
  const raw = String(number || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!/^HG[BC]20[2-9]\d\d{9}$/.test(raw)) return false;
  const year = raw.slice(3, 7);
  if (year !== String(new Date().getFullYear()) && year !== String(new Date().getFullYear() - 1)) return false;
  const wantPlan = planCode(plan || (raw[13] === "2" ? "year" : "month"));
  if (plan && raw[13] !== wantPlan) return false;
  const base = raw.slice(0, 14);
  const digest = await hmacHex(invoiceSecret(env), base);
  const check = String(parseInt(digest.slice(0, 4), 16) % 100).padStart(2, "0");
  return raw.slice(14) === check;
}

export async function invoiceToken(invoiceNumber, email, amount, plan, env) {
  return hmacHex(invoiceSecret(env), [invoiceNumber, email, amount, plan].join("|"));
}

export async function invoiceTokenValid(body, env) {
  const invoiceNumber = String(body.invoiceNumber || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const amount = Number(body.amount);
  const plan = body.plan === "year" ? "year" : "month";
  if (!(await invoiceNumberValid(invoiceNumber, plan, env))) return false;
  const expect = await invoiceToken(invoiceNumber, email, amount, plan, env);
  return String(body.token || "").toLowerCase() === expect;
}

function trendyolAuth(env) {
  return "Basic " + btoa(String(env.TRENDYOL_API_KEY) + ":" + String(env.TRENDYOL_API_SECRET));
}

function trendyolHeaders(env) {
  const sellerId = String(env.TRENDYOL_SELLER_ID);
  return {
    Authorization: trendyolAuth(env),
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": sellerId + " - HarbiGrup",
  };
}

function invoicePayload(body, vat, invoiceNumber) {
  const name = String(body.first || "").trim() + " " + String(body.last || "").trim();
  return {
    invoiceNumber,
    invoiceDate: new Date().toISOString(),
    invoiceType: "SATIS",
    invoiceProfile: "EARSIVFATURA",
    currency: "TRY",
    taxInclusive: true,
    taxRate: 20,
    taxExclusiveAmount: vat.net,
    taxAmount: vat.vat,
    payableAmount: vat.gross,
    supplierTitle: "Tolkan Uğur Özel",
    customer: {
      name: name.trim(),
      email: String(body.email || "").trim().toLowerCase(),
      phone: String(body.phone || "").replace(/\D/g, ""),
      address: String(body.address || "").trim(),
      taxNumber: String(body.taxId || "").replace(/\D/g, ""),
    },
    lines: [
      {
        name:
          body.plan === "year"
            ? productTitle(productKind(body)) + " yıllık abonelik"
            : productTitle(productKind(body)) + " aylık abonelik",
        quantity: 1,
        unitPrice: vat.net,
        vatRate: 20,
        vatAmount: vat.vat,
        lineAmount: vat.gross,
      },
    ],
  };
}

function pickInvoiceNo(data, fallback) {
  if (!data || typeof data !== "object") return fallback;
  return String(
    data.invoiceNumber ||
      data.invoiceNo ||
      data.documentNumber ||
      data.ettn ||
      data.id ||
      data?.invoice?.invoiceNumber ||
      fallback
  );
}

export async function trendyolCreateInvoice(env, body, vat, invoiceNumber) {
  if (!trendyolConfigured(env)) {
    return { ok: false, skipped: true, invoiceNumber, error: "E-fatura anahtarları yok." };
  }
  const sellerId = String(env.TRENDYOL_SELLER_ID);
  const base = String(env.TRENDYOL_BASE_URL || "https://apigw.trendyol.com").replace(/\/$/, "");
  const payload = invoicePayload(body, vat, invoiceNumber);
  const paths = [
    `/integration/invoice/sellers/${sellerId}/invoices`,
    `/integration/invoice/sellers/${sellerId}/e-archive`,
    `/sapigw/suppliers/${sellerId}/invoices`,
  ];
  let last = { ok: false, invoiceNumber, error: "E-fatura yanıt vermedi." };
  for (const path of paths) {
    try {
      const res = await fetch(base + path, {
        method: "POST",
        headers: trendyolHeaders(env),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { ok: true, invoiceNumber: pickInvoiceNo(data, invoiceNumber), data };
      }
      last = {
        ok: false,
        invoiceNumber,
        error: data.message || data.error || data.exception || "HTTP " + res.status,
      };
    } catch (err) {
      last = { ok: false, invoiceNumber, error: err.message || "E-fatura bağlantı hatası." };
    }
  }
  return last;
}

export async function trendyolFindInvoice(env, invoiceNumber) {
  if (!trendyolConfigured(env)) return { ok: false, skipped: true };
  const sellerId = String(env.TRENDYOL_SELLER_ID);
  const base = String(env.TRENDYOL_BASE_URL || "https://apigw.trendyol.com").replace(/\/$/, "");
  const q = encodeURIComponent(invoiceNumber);
  const paths = [
    `/integration/invoice/sellers/${sellerId}/invoices?invoiceNumber=${q}`,
    `/sapigw/suppliers/${sellerId}/invoices?invoiceNumber=${q}`,
  ];
  for (const path of paths) {
    try {
      const res = await fetch(base + path, { headers: trendyolHeaders(env) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) continue;
      const text = JSON.stringify(data).toUpperCase();
      if (text.includes(String(invoiceNumber).toUpperCase())) return { ok: true, data };
    } catch {
      /* next */
    }
  }
  return { ok: false };
}

export async function sendInvoiceMail(env, body, vat, invoiceNumber, trendyolOk) {
  if (!mailConfigured(env)) {
    return { ok: false, skipped: true, error: "E-posta anahtarı yok (RESEND_API_KEY)." };
  }
  const from = String(env.MUSIC_MAIL_FROM || env.RESEND_FROM);
  const to = String(body.email || "").trim().toLowerCase();
  const kind = productKind(body);
  const title = productTitle(kind);
  const planLabel = body.plan === "year" ? "Yıllık abonelik" : "Aylık abonelik";
  const html = `<p>Merhaba ${String(body.first || "").trim()},</p>
<p>${title} ödemeniz için e-arşiv fatura oluşturuldu. KDV oranı <strong>%20</strong>.</p>
<p><strong>Fatura no:</strong> ${invoiceNumber}<br/>
<strong>Alıcı:</strong> Tolkan Uğur Özel<br/>
<strong>Hizmet:</strong> ${planLabel}<br/>
<strong>Matrah:</strong> ${vat.net.toFixed(2)} ₺<br/>
<strong>KDV %20:</strong> ${vat.vat.toFixed(2)} ₺<br/>
<strong>Genel toplam:</strong> ${vat.gross.toFixed(2)} ₺</p>
<p>Üyeliğinizi aktif etmek için uygulamada fatura numarasını girin.</p>
<p>${trendyolOk ? "Fatura e-Fatura üzerinden kesildi." : "Fatura kaydı oluştu; hesap yanıt vermezse GİB aktarımı Cloudflare anahtarları tamamlanınca yapılır."}</p>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Harbi Grup e-fatura " + invoiceNumber,
      html,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data, error: data.message || (res.ok ? "" : "E-posta gönderilemedi.") };
}
