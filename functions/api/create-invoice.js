// Cloudflare Pages Function — POST /api/create-invoice
//
// The ebook checkout used to send everyone to the same static NOWPayments
// invoice (iid=5265919384). That's fine for taking payment, but it means
// NOWPayments has no way to tell us WHO paid — every buyer looks the same.
// Each checkout gets its own invoice instead, tagged with the buyer's
// email in order_id, so we know who to email once they've actually paid
// and what to tell the tracking pixels.
//
// Two separate things happen once a payment confirms, on two separate
// paths:
//   1. Delivery — NOWPayments calls ipn_callback_url (fulfill-order.js)
//      directly from its own servers. That's the only thing that
//      actually emails the buyer their download; it doesn't depend on
//      their browser doing anything.
//   2. Ad conversion tracking — client-side, on the thank-you page this
//      redirects to (success_url below), firing the same X pixel and
//      GA4 gtag calls already used for the Lead event. We tried a
//      server-side version of this too (IPN -> X's Conversion API), but
//      X's Conversion API requires a separate "Ads API access" approval
//      that isn't granted by default, so that path is on hold —
//      client-side tracking works today without waiting on it.
//
// Requires these Cloudflare Pages environment variables:
//   NOWPAYMENTS_API_KEY    — NOWPayments dashboard → Payment settings → API keys.
//   NOWPAYMENTS_IPN_SECRET — NOWPayments dashboard → Settings → IPN secret key
//                            (only needed for fulfill-order.js to verify
//                            the callback below is genuinely from NOWPayments).

const PRICE_USD = 19;

// Exit-intent discount: the popup on the ebook page can offer $14 instead
// of $19. The client only ever sends a discount CODE ("exit14"), never a
// price — the actual $14 is looked up here, server-side, against a known
// list of codes. That way nobody can open devtools and POST an arbitrary
// price to get the ebook for less than we intend to allow.
const DISCOUNT_PRICE_USD = 14;
const VALID_DISCOUNT_CODES = new Set(["exit14"]);

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

  const discountCode = (body.discount || "").trim();
  const discountApplied = VALID_DISCOUNT_CODES.has(discountCode);
  const priceAmount = discountApplied ? DISCOUNT_PRICE_USD : PRICE_USD;

  // No database, no IPN needed — order_id is just for your own NOWPayments
  // dashboard reference now, not parsed back out anywhere.
  const orderId = `${email}::${Date.now()}`;
  const origin = new URL(request.url).origin;

  const successUrl = new URL(`${origin}/speed-to-lead-ebook-thanks`);
  successUrl.searchParams.set("email", email);
  successUrl.searchParams.set("value", String(priceAmount));

  let nowRes;
  try {
    nowRes = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: {
        "x-api-key": env.NOWPAYMENTS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price_amount: priceAmount,
        price_currency: "usd",
        order_id: orderId,
        order_description: discountApplied
          ? "Speed-to-Lead Ebook (exit-intent $5 off)"
          : "Speed-to-Lead Ebook",
        ipn_callback_url: `${origin}/api/fulfill-order`,
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
  return json({ id: invoice.id, invoice_url: invoice.invoice_url, price: priceAmount });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
