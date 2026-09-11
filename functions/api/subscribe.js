// Cloudflare Pages Function — POST /api/subscribe
//
// Backs the newsletter forms in src/blog/_includes/base.njk (TOFU and MOFU
// funnel-stage CTAs). Takes an email from the client, creates a beehiiv
// subscription server-side, and returns a small JSON shape the frontend's
// fetch handler already knows how to read: { ok: boolean, message: string }.
//
// The beehiiv API key never reaches the browser — it only ever lives here,
// read from the Cloudflare Pages environment at request time.
//
// Requires these Cloudflare Pages environment variables (Settings →
// Environment variables, set as "Secret" for the API key):
//   BEEHIIV_API_KEY           — beehiiv dashboard → Settings → Workspace
//                                Settings → API → Create New API Key.
//   BEEHIIV_PUBLICATION_ID    — same page, "Publication ID" section
//                                (starts with "pub_").

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, message: "Invalid request." }, 400);
  }

  const email = (body.email || "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, message: "That doesn't look like a valid email." }, 400);
  }

  if (!env.BEEHIIV_API_KEY || !env.BEEHIIV_PUBLICATION_ID) {
    console.error("subscribe.js: missing BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID env var");
    return json({ ok: false, message: "Signup is temporarily unavailable. Mind DMing me on X instead?" }, 500);
  }

  let beehiivRes;
  try {
    beehiivRes = await fetch(
      `https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUBLICATION_ID}/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.BEEHIIV_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          reactivate_existing: true,
          send_welcome_email: true,
          utm_source: "damirbuilds.com",
          utm_medium: "blog",
        }),
      }
    );
  } catch (e) {
    console.error("subscribe.js: could not reach beehiiv", e);
    return json({ ok: false, message: "Couldn't reach the signup service. Mind trying again?" }, 502);
  }

  // beehiiv's create-subscription endpoint is an upsert by email: POSTing
  // an email that's already an active subscriber comes back 200/201 with
  // the existing subscription rather than an error, so the success branch
  // below already covers "already subscribed" as a soft success with no
  // special-casing needed. The regex fallback in the error branch is a
  // second safety net in case that ever isn't true for some account/plan
  // state — never surface a duplicate email as a hard error to the reader.
  if (beehiivRes.ok) {
    return json({ ok: true, message: "You're in — check your inbox to confirm." });
  }

  let errorDetail = "";
  try {
    const errBody = await beehiivRes.json();
    errorDetail = JSON.stringify(errBody);
    if (/already|exist/i.test(errorDetail)) {
      return json({ ok: true, message: "Looks like you're already subscribed — you're all set." });
    }
  } catch (e) {
    // Non-JSON error body — fall through to the generic error response.
  }

  console.error(`subscribe.js: beehiiv returned ${beehiivRes.status}`, errorDetail);
  return json(
    { ok: false, message: "Something went wrong on my end. Mind trying again, or DM me on X?" },
    502
  );
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
