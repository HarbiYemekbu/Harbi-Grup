import { iyzicoConfigured } from "./_lib/iyzico.js";

export async function onRequestGet(context) {
  const ready = iyzicoConfigured(context.env);
  return Response.json(
    {
      ready,
      provider: "iyzico",
      sandbox: String(context.env.IYZICO_SANDBOX || "") === "1",
      hint: ready
        ? "Kart ödemesi iyzico 3D Secure sayfasında alınır."
        : "Cloudflare Pages ortamına IYZICO_API_KEY ve IYZICO_SECRET_KEY ekleyin. Anahtarları sohbete yazmayın.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
