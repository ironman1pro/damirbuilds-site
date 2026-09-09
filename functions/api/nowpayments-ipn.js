// Cloudflare Pages Function — POST /api/nowpayments-ipn
//
// NOWPayments calls this every time a payment's status changes. We verify
// the request is genuinely from NOWPayments (HMAC-SHA512 over the body
// with keys sorted alphabetically, signed with your IPN secret, per their
// docs), and only on a "finished" payment do we fire real server-side
// conversion events — to X Ads (using the buyer's email, since we know
// who actually paid this time) and to GA4.
//
// This is the "true purchase" signal: unlike the client-side Lead event
// (which just means someone reached the payment step), this only fires
// once NOWPayments itself confirms the crypto payment settled.
//
// Requires these environment variables in Cloudflare Pages project
// settings (Settings → Environment variables):
//   NOWPAYMENTS_IPN_SECRET   — NOWPayments dashboard, Payment settings
//   X_ADS_ACCESS_TOKEN       — X Developer Console user access token,
//                              generated for an account with AD_MANAGER
//                              or ACCOUNT_ADMIN access on your ads account
//   GA4_API_SECRET           — GA4 Admin → Data Streams → your web stream
//                              → Measurement Protocol API secrets → Create

const PIXEL_ID = "reor2";
const X_EVENT_ID = "tw-reor2-rf3rq";
const GA4_MEASUREMENT_ID = "G-PQP82JKXY1";

export async function onRequestPost(context) {
  const { request, env } = context;

  const rawBody = await request.text();
  const signature = request.headers.get("x-nowpayments-sig");

  if (!env.NOWPAYMENTS_IPN_SECRET || !signature) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return new Response("Bad request", { status: 400 });
  }

  const sortedBody = JSON.stringify(sortKeysDeep(payload));
  const expectedSig = await hmacSha512Hex(sortedBody, env.NOWPAYMENTS_IPN_SECRET);

  if (expectedSig !== signature) {
    return new Response("Invalid signature", { status: 401 });
  }

  // Other statuses (waiting, confirming, confirmed, sending,
  // partially_paid, failed, expired, refunded) are acknowledged so
  // NOWPayments doesn't keep retrying, but only "finished" is a real,
  // completed purchase worth reporting as a conversion.
  if (payload.payment_status !== "finished") {
    return new Response("OK (status ignored)", { status: 200 });
  }

  const orderId = payload.order_id || "";
  const separatorIndex = orderId.lastIndexOf("::");
  const email = separatorIndex > -1 ? orderId.slice(0, separatorIndex) : null;

  const value = String(payload.price_amount ?? 19);
  const conversionId = String(payload.payment_id ?? orderId);
  const conversionTime = new Date().toISOString();

  const results = { x: null, ga4: null };

  if (email && env.X_ADS_ACCESS_TOKEN) {
    results.x = await fireXConversion({
      email,
      value,
      conversionId,
      conversionTime,
      accessToken: env.X_ADS_ACCESS_TOKEN,
    });
  }

  if (env.GA4_API_SECRET) {
    results.ga4 = await fireGa4Purchase({
      value,
      conversionId,
      apiSecret: env.GA4_API_SECRET,
    });
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function fireXConversion({ email, value, conversionId, conversionTime, accessToken }) {
  const hashedEmail = await sha256Hex(email.trim().toLowerCase());
  try {
    const res = await fetch(`https://ads-api.x.com/12/measurement/conversions/${PIXEL_ID}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversions: [
          {
            event_id: X_EVENT_ID,
            conversion_time: conversionTime,
            identifiers: [{ hashed_email: hashedEmail }],
            value,
            currency: "USD",
            conversion_id: conversionId,
          },
        ],
      }),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function fireGa4Purchase({ value, conversionId, apiSecret }) {
  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${apiSecret}`,
      {
        method: "POST",
        body: JSON.stringify({
          // No original browser client_id is available server-side, so
          // this won't merge into the same GA4 session as the earlier
          // "generate_lead" event — it still records correctly as its
          // own purchase for reporting and revenue totals.
          client_id: `server.${conversionId}`,
          events: [
            {
              name: "purchase",
              params: {
                value: Number(value),
                currency: "USD",
                transaction_id: conversionId,
              },
            },
          ],
        }),
      }
    );
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
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

async function hmacSha512Hex(message, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bufferToHex(sig);
}

async function sha256Hex(message) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return bufferToHex(digest);
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
