// Shared by functions/api/nowpayments-ipn.js and functions/api/debug-x-conversion.js
// so the real handler and the diagnostic tool run the EXACT same code path —
// a diagnostic that used its own copy of the logic could pass while the real
// one still has a bug, which defeats the point of testing it.

export const PIXEL_ID = "reor2";
// A dedicated Purchase-type event — NOT the same event ID as the
// client-side Lead event (tw-reor2-rf3rq) fired from speed-to-lead-ebook.html
// when someone reaches the payment step. Keeping these separate is what
// lets X Ads report Leads and actual Purchases as distinct conversions.
export const X_EVENT_ID = "tw-reor2-rf3t8";
export const GA4_MEASUREMENT_ID = "G-PQP82JKXY1";

export async function fireXConversion({ email, value, conversionId, conversionTime, creds }) {
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
    const bodyText = await res.text();
    if (!res.ok) {
      console.error("[conversions] X API rejected the conversion:", res.status, bodyText);
    }
    return { ok: res.ok, status: res.status, body: bodyText.slice(0, 1000) };
  } catch (e) {
    console.error("[conversions] X API call threw:", String(e));
    return { ok: false, error: String(e) };
  }
}

// X's Ads API is OAuth 1.0a — the signature only covers the URL and the
// OAuth params themselves (this endpoint has no query params and a JSON,
// not form-encoded, body, so the body isn't part of the signature base
// string — that's standard for JSON-bodied OAuth 1.0a requests).
export async function buildOAuth1Header({ method, url, creds }) {
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

export async function fireGa4Purchase({ value, conversionId, apiSecret }) {
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
    if (!res.ok) {
      const bodyText = await res.text();
      console.error("[conversions] GA4 rejected the event:", res.status, bodyText);
      return { ok: false, status: res.status, body: bodyText.slice(0, 1000) };
    }
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error("[conversions] GA4 call threw:", String(e));
    return { ok: false, error: String(e) };
  }
}

export function pctEncode(str) {
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

export function sortKeysDeep(value) {
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

export async function hmacSha512Hex(message, secret) {
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

export async function sha256Hex(message) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return bufferToHex(digest);
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
