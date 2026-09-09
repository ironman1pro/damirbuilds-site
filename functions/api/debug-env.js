// Cloudflare Pages Function — GET /api/debug-env
//
// Reports which required environment variables are actually visible to
// THIS deployment — true/false only, never the actual secret values.
// Cloudflare Pages scopes variables separately per environment
// (Production vs Preview); a variable added to only one won't show up
// for requests served by the other, which is a common, silent cause of
// "it's set in the dashboard but the function can't see it."
//
// Delete this file once debugging is done — it's low-risk (no values
// exposed) but there's no reason to leave a diagnostic endpoint live
// permanently.

export async function onRequestGet(context) {
  const { env } = context;

  const vars = [
    "NOWPAYMENTS_API_KEY",
    "NOWPAYMENTS_IPN_SECRET",
    "GA4_API_SECRET",
    "X_API_KEY",
    "X_API_SECRET",
    "X_ACCESS_TOKEN",
    "X_ACCESS_TOKEN_SECRET",
  ];

  const status = {};
  for (const name of vars) {
    status[name] = Boolean(env[name]);
  }

  return new Response(JSON.stringify({ environment_variables_present: status }, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
