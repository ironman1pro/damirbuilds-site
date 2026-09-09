// Cloudflare Pages Function — POST /api/fulfill-order
//
// This is the ONLY thing that actually delivers the ebook. NOWPayments
// calls this endpoint (an IPN webhook) directly from its own servers the
// moment a payment genuinely confirms on-chain — it does not depend on
// the buyer's browser doing anything. The client-side redirect to
// speed-to-lead-ebook-thanks (see create-invoice.js's success_url) is
// only there for ad conversion tracking and a nice "you're all set"
// page; if the buyer closes the tab, has an ad blocker, or their
// connection drops before that redirect happens, this webhook still
// fires and they still get the email. Delivery and conversion tracking
// are two separate paths on purpose.
//
// Requires these Cloudflare Pages environment variables:
//   NOWPAYMENTS_IPN_SECRET — NOWPayments dashboard → Settings → IPN secret key.
//   RESEND_API_KEY         — from resend.com (free tier covers this easily).
// Optional:
//   RESEND_FROM_EMAIL — defaults to Resend's shared test sender
//     ("onboarding@resend.dev"), which works immediately with zero setup.
//     Swap in something like "DamirBuilds <hello@damirbuilds.com>" once
//     that domain is verified in Resend (a couple of DNS records, a few
//     minutes) so the email doesn't look like it's from a random test domain.
//   EBOOK_DOWNLOAD_URL — defaults to <site>/downloads/speed-to-lead-ebook-bf948cbd31fb4ba1.pdf,
//     an unguessable filename rather than something predictable like
//     speed-to-lead-ebook.pdf, so someone can't just guess the URL. It's
//     still a public, unauthenticated link — anyone who has it (a buyer
//     forwards it, it leaks) can download it — this only stops random
//     guessing, not sharing. static-site/_headers marks /downloads/* as
//     noindex + no-store so it never gets crawled, cached, or indexed.
//     Drop the real file at that exact path (or change this default, or
//     set the env var, to use your own random name) and it works with no
//     other code changes.
//
// Also requires create-invoice.js to keep sending ipn_callback_url
// pointing at this endpoint when it creates each invoice — that's what
// tells NOWPayments to call this in the first place.

export async function onRequestPost(context) {
  const { request, env } = context;

  const rawBody = await request.text();
  const signature = request.headers.get("x-nowpayments-sig");

  if (!env.NOWPAYMENTS_IPN_SECRET) {
    return new Response("Server misconfigured: missing NOWPAYMENTS_IPN_SECRET", { status: 500 });
  }
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const sortedPayload = sortKeysDeep(payload);
  const expectedSig = await hmacSha512Hex(env.NOWPAYMENTS_IPN_SECRET, JSON.stringify(sortedPayload));

  if (expectedSig !== signature) {
    return new Response("Invalid signature", { status: 401 });
  }

  // NOWPayments sends one IPN call per status change as an order moves
  // through its lifecycle (waiting -> confirming -> confirmed ->
  // finished, or partially_paid / failed / expired along the way). Only
  // "finished" means the money has actually settled — every earlier call
  // gets a plain 200 with nothing sent, so NOWPayments doesn't retry them.
  if (payload.payment_status !== "finished") {
    return new Response("OK (status not final yet)", { status: 200 });
  }

  const orderId = payload.order_id || "";
  const email = orderId.split("::")[0];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response("OK (no valid email in order_id, nothing to send)", { status: 200 });
  }

  if (!env.RESEND_API_KEY) {
    // The payment is real and confirmed either way — still 200 so
    // NOWPayments doesn't keep retrying — but a payment with no email
    // sent is exactly the case worth surfacing loudly. Check Cloudflare's
    // function logs if this ever shows up in production.
    return new Response("Payment confirmed but RESEND_API_KEY is not set — email not sent", { status: 200 });
  }

  const origin = new URL(request.url).origin;
  const downloadUrl = env.EBOOK_DOWNLOAD_URL || `${origin}/downloads/speed-to-lead-ebook-bf948cbd31fb4ba1.pdf`;
  const fromAddress = env.RESEND_FROM_EMAIL || "DamirBuilds <onboarding@resend.dev>";

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: email,
        subject: "Your Speed-to-Lead workflow is ready",
        html: `
          <p>Thanks for grabbing the Speed-to-Lead workflow — here's your download:</p>
          <p><a href="${downloadUrl}">${downloadUrl}</a></p>
          <p>Inside: the exact node sequence, the AI prompt that parses incoming leads, the auto-reply template, and the edge cases that break it.</p>
          <p>Anything not working, or questions setting it up? Just reply to this email or DM me on X: https://x.com/damirbuilds</p>
        `,
      }),
    });
  } catch (e) {
    // Swallowed on purpose: the payment already happened regardless of
    // whether this send succeeded, and returning a non-200 here would
    // make NOWPayments retry the entire IPN indefinitely. Resend's own
    // dashboard activity log is the place to check for delivery failures.
  }

  return new Response("OK", { status: 200 });
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {});
  }
  return value;
}

async function hmacSha512Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
