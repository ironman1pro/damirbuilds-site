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
//   NOWPAYMENTS_IPN_SECRET    — NOWPayments dashboard, Payment settings
//   GA4_API_SECRET            — GA4 Admin → Data Streams → your web stream
//                               → Measurement Protocol API secrets → Create
//
// X's Ads Conversion API is an older-style API and requires full OAuth 1.0a
// request signing, not a single bearer token — so four separate values are
// needed, all from the X Developer Console app tied to a handle with
// AD_MANAGER or ACCOUNT_ADMIN access on your ads account:
//   X_API_KEY                 — the app's "API Key" (consumer key)
//   X_API_SECRET               — the app's "API Key Secret" (consumer secret)
//   X_ACCESS_TOKEN             — that handle's "Access Token"
//   X_ACCESS_TOKEN_SECRET      — that handle's "Access Token Secret"

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

  const hasXCreds =
    env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_TOKEN_SECRET;

  if (email && hasXCreds) {
    results.x = await fireXConversion({
      email,
      value,
      conversionId,
      conversionTime,
      creds: {
        apiKey: env.X_API_KEY,
        apiSecret: env.X_API_SECRET,
        accessToken: env.X_ACCESS_TOKEN,
        accessTokenSecret: env.X_ACCESS_TOKEN_SECRET,
      },
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

async function fireXConversion({ email, value, conversionId, conversionTime, creds }) {
  const hashedEmail = await sha256Hex(email.trim().toLowerCase());
  const url = `https://ads-api.x.com/12/measurement/conversions/${PIXEL_ID}`;
  try {
    const authHeader = await buildOAuth1Header({ method: "POST", url, creds });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
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

// X's Ads API is OAuth 1.0a — the signature only covers the URL and the
// OAuth params themselves (this endpoint has no query params and a JSON,
// not form-encoded, body, so the body isn't part of the signature base
// string — that's standard for JSON-bodied OAuth 1.0a requests).
async function buildOAuth1Header({ method, url, creds }) {
  const oauthParams = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: randomHex(32),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  const sortedKeys = Object.keys(oauthParams).sort();
  const paramString = sortedKeys
    .map((k) => `${pctEncode(k)}=${pctEncode(oauthParams[k])}`)
    .join("&");

  const baseString = [method.toUpperCase(), pctEncode(url), pctEncode(paramString)].join("&");
  const signingKey = `${pctEncode(creds.apiSecret)}&${pctEncode(creds.accessTokenSecret)}`;
  const signature = await hmacSha1Base64(baseString, signingKey);

  const headerParams = { ...oauthParams, oauth_signature: signature };
  return (
    "OAuth " +
    Object.keys(headerParams)
      .sort()
      .map((k) => `${pctEncode(k)}="${pctEncode(headerParams[k])}"`)
      .join(", ")
  );
}

function pctEncode(str) {
  return encodeURIComponent(str).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function randomHex(len) {
  const bytes = new Uint8Array(Math.ceil(len / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, len);
}

async function hmacSha1Base64(message, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
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
