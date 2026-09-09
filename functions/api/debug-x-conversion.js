// Cloudflare Pages Function — POST /api/debug-x-conversion
//
// Fires ONE real test conversion straight to X's Conversion API, using the
// exact same fireXConversion() code the real IPN handler uses (imported
// from functions/_lib/conversions.js, not a copy) — and returns X's raw
// response directly in the HTTP response, so you see success or the exact
// rejection reason immediately, without waiting on a real crypto payment
// and without needing to dig through Cloudflare's log viewer.
//
// This isolates the riskiest, never-yet-proven part (OAuth 1.0a signing +
// the four X credentials) from the rest of the payment flow, so a failure
// here can be fixed BEFORE spending real money on an end-to-end test.
//
// Call it with:
//   curl -X POST https://damirbuilds.com/api/debug-x-conversion \
//     -H "Content-Type: application/json" \
//     -d '{"email":"you@example.com","confirm":true}'
//
// "confirm": true is required on purpose — a small guard so this doesn't
// fire just because a bot or crawler happens to hit the URL.
//
// Delete this file once the real flow is confirmed working — it's a real,
// live conversion each time it's called, which is fine for testing while
// no ads are running, but not something to leave reachable indefinitely.

import { fireXConversion } from "../_lib/conversions.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (body.confirm !== true) {
    return json({ error: 'Pass "confirm": true in the JSON body to run this test.' }, 400);
  }

  const email = (body.email || "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Valid email required" }, 400);
  }

  const hasXCreds =
    env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_TOKEN_SECRET;

  if (!hasXCreds) {
    return json(
      {
        error: "Missing X credentials in this environment",
        present: {
          X_API_KEY: Boolean(env.X_API_KEY),
          X_API_SECRET: Boolean(env.X_API_SECRET),
          X_ACCESS_TOKEN: Boolean(env.X_ACCESS_TOKEN),
          X_ACCESS_TOKEN_SECRET: Boolean(env.X_ACCESS_TOKEN_SECRET),
        },
      },
      500
    );
  }

  const result = await fireXConversion({
    email,
    value: "19",
    conversionId: `debug-${Date.now()}`,
    conversionTime: new Date().toISOString(),
    creds: {
      apiKey: env.X_API_KEY,
      apiSecret: env.X_API_SECRET,
      accessToken: env.X_ACCESS_TOKEN,
      accessTokenSecret: env.X_ACCESS_TOKEN_SECRET,
    },
  });

  return json({ sent: true, x_response: result });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
