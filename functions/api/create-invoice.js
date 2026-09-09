// Cloudflare Pages Function — POST /api/create-invoice
//
// The ebook checkout used to send everyone to the same static NOWPayments
// invoice (iid=5265919384). That's fine for taking payment, but it means
// NOWPayments has no way to tell us WHO paid — every buyer looks the same.
// Each checkout gets its own invoice instead, so we know who to redirect
// and what to tell the tracking pixels once they've actually paid.
//
// Conversion tracking happens on the client side, on the thank-you page
// this redirects to (success_url below) — it fires the same X pixel and
// GA4 gtag calls already used for the Lead event, using the email and
// price passed through the URL. We tried a server-side approach first
// (NOWPayments IPN webhook -> X's Conversion API), but X's Conversion API
// requires a separate "Ads API access" approval that isn't granted by
// default, so that path is on hold — this client-side approach works
// today without waiting on that approval.
//
// Requires the NOWPAYMENTS_API_KEY environment variable to be set in the
// Cloudflare Pages project settings (Settings → Environment variables).
// Get the key from your NOWPayments dashboard: Payment settings → API keys.

const PRICE_USD = 19;

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = (body.email || "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Valid email required" }, 400);
  }

  if (!env.NOWPAYMENTS_API_KEY) {
    return json({ error: "Server misconfigured: missing NOWPAYMENTS_API_KEY" }, 500);
  }

  // No database, no IPN needed — order_id is just for your own NOWPayments
  // dashboard reference now, not parsed back out anywhere.
  const orderId = `${email}::${Date.now()}`;
  const origin = new URL(request.url).origin;

  const successUrl = new URL(`${origin}/speed-to-lead-ebook-thanks`);
  successUrl.searchParams.set("email", email);
  successUrl.searchParams.set("value", String(PRICE_USD));

  let nowRes;
  try {
    nowRes = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": env.NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: PRICE_USD,
        price_currency: "usd",
        order_id: orderId,
        order_description: "Speed-to-Lead Ebook",
        success_url: successUrl.toString(),
        cancel_url: `${origin}/speed-to-lead-ebook`,
      }),
    });
  } catch (e) {
    return json({ error: "Could not reach NOWPayments" }, 502);
  }

  if (!nowRes.ok) {
    const errText = await nowRes.text();
    return json({ error: "NOWPayments invoice creation failed", detail: errText }, 502);
  }

  const invoice = await nowRes.json();
  return json({ id: invoice.id, invoice_url: invoice.invoice_url });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
