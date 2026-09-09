// Cloudflare Pages Function — POST /api/create-invoice
//
// The ebook checkout used to send everyone to the same static NOWPayments
// invoice (iid=5265919384). That's fine for taking payment, but it means
// NOWPayments has no way to tell us WHO paid — every buyer looks the same.
// To get a real, per-buyer "purchase" signal we can hand to X Ads / GA4,
// each checkout needs its own invoice.
//
// The buyer's email rides along as part of order_id ("<email>::<ms since
// epoch>") instead of in a database — nowpayments-ipn.js just splits it
// back out when the payment finishes. It'll show up in plain text in your
// NOWPayments dashboard order history, which is fine (only you see that)
// and is actually handy for manually looking up an order.
//
// Requires the NOWPAYMENTS_API_KEY environment variable to be set in the
// Cloudflare Pages project settings (Settings → Environment variables).
// Get the key from your NOWPayments dashboard: Payment settings → API keys.

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

  const orderId = `${email}::${Date.now()}`;
  const origin = new URL(request.url).origin;

  let nowRes;
  try {
    nowRes = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": env.NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // TEMP TEST PRICE — was 19, dropped to 1 for a real end-to-end
        // checkout test. MUST be changed back to 19 before real customers
        // use this page.
        price_amount: 1,
        price_currency: "usd",
        order_id: orderId,
        order_description: "Speed-to-Lead Ebook",
        ipn_callback_url: `${origin}/api/nowpayments-ipn`,
        success_url: `${origin}/speed-to-lead-ebook?paid=1`,
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
