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
// settings (Settings → Environment variables), added to BOTH the
// Production and Preview environments:
//   NOWPAYMENTS_IPN_SECRET    — NOWPayments dashboard, Payment settings
//   GA4_API_SECRET            — GA4 Admin → Data Streams → your web stream
//                               → Measurement Protocol API secrets → Create
//   X_API_KEY                 — X Developer Console app's "API Key"
//   X_API_SECRET              — that app's "API Key Secret"
//   X_ACCESS_TOKEN            — that handle's "Access Token"
//   X_ACCESS_TOKEN_SECRET     — that handle's "Access Token Secret"
//
// The X-conversion and GA4-conversion logic lives in functions/_lib/
// conversions.js, shared with functions/api/debug-x-conversion.js — that
// diagnostic endpoint runs this exact same code path against X's real API
// without needing a real payment, so auth problems can be caught and fixed
// before spending money on an end-to-end test.

import { fireXConversion, fireGa4Purchase, sortKeysDeep, hmacSha512Hex } from "../_lib/conversions.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  console.log("[nowpayments-ipn] request received");

  const rawBody = await request.text();
  const signature = request.headers.get("x-nowpayments-sig");

  if (!env.NOWPAYMENTS_IPN_SECRET) {
    console.error("[nowpayments-ipn] NOWPAYMENTS_IPN_SECRET is not set in this environment");
    return new Response("Unauthorized", { status: 401 });
  }
  if (!signature) {
    console.error("[nowpayments-ipn] request had no x-nowpayments-sig header");
    return new Response("Unauthorized", { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    console.error("[nowpayments-ipn] body was not valid JSON:", rawBody.slice(0, 500));
    return new Response("Bad request", { status: 400 });
  }

  const sortedBody = JSON.stringify(sortKeysDeep(payload));
  const expectedSig = await hmacSha512Hex(sortedBody, env.NOWPAYMENTS_IPN_SECRET);

  if (expectedSig !== signature) {
    console.error(
      "[nowpayments-ipn] signature mismatch — expected",
      expectedSig,
      "got",
      signature,
      "for payment_id",
      payload.payment_id
    );
    return new Response("Invalid signature", { status: 401 });
  }

  console.log(
    "[nowpayments-ipn] signature OK — payment_id",
    payload.payment_id,
    "status",
    payload.payment_status,
    "order_id",
    payload.order_id
  );

  // Other statuses (waiting, confirming, confirmed, sending,
  // partially_paid, failed, expired, refunded) are acknowledged so
  // NOWPayments doesn't keep retrying, but only "finished" is a real,
  // completed purchase worth reporting as a conversion.
  if (payload.payment_status !== "finished") {
    console.log("[nowpayments-ipn] status is not 'finished', ignoring");
    return new Response("OK (status ignored)", { status: 200 });
  }

  const orderId = payload.order_id || "";
  const separatorIndex = orderId.lastIndexOf("::");
  const email = separatorIndex > -1 ? orderId.slice(0, separatorIndex) : null;

  if (!email) {
    console.error("[nowpayments-ipn] could not recover an email from order_id:", orderId);
  }

  const value = String(payload.price_amount ?? 19);
  const conversionId = String(payload.payment_id ?? orderId);
  const conversionTime = new Date().toISOString();

  const results = { x: null, ga4: null };

  const hasXCreds =
    env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_TOKEN_SECRET;

  if (!hasXCreds) {
    console.error(
      "[nowpayments-ipn] missing one or more X credentials — X_API_KEY:",
      !!env.X_API_KEY,
      "X_API_SECRET:",
      !!env.X_API_SECRET,
      "X_ACCESS_TOKEN:",
      !!env.X_ACCESS_TOKEN,
      "X_ACCESS_TOKEN_SECRET:",
      !!env.X_ACCESS_TOKEN_SECRET
    );
  }

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
    console.log("[nowpayments-ipn] X conversion result:", JSON.stringify(results.x));
  }

  if (env.GA4_API_SECRET) {
    results.ga4 = await fireGa4Purchase({
      value,
      conversionId,
      apiSecret: env.GA4_API_SECRET,
    });
    console.log("[nowpayments-ipn] GA4 result:", JSON.stringify(results.ga4));
  } else {
    console.error("[nowpayments-ipn] GA4_API_SECRET not set");
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
