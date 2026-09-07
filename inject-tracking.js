// Runs after `eleventy` and `copy-static.js` as part of `npm run build`.
// Walks every .html file in _site/ (both the Eleventy-built blog pages and
// the copied static-site/ marketing pages) and injects the GA4 + X Ads +
// Snitcher tracking snippets right after each page's <head> tag.
//
// This is the single source of truth for site-wide tracking — the tags
// live ONLY here, not pasted into individual page source files. Add a new
// static page to static-site/, or a new blog post, and it gets tagged
// automatically the next time `npm run build` runs. No per-page edits,
// ever, for any of the tags.
//
// If you need to swap the GA4 measurement ID, the X pixel ID, or the
// Snitcher profile ID, change it once here and rebuild — every page picks
// it up.

const fs = require("fs");
const path = require("path");

const SITE_DIR = path.join(__dirname, "_site");

const GA_MEASUREMENT_ID = "G-PQP82JKXY1";
const X_PIXEL_ID = "reor2";
const SNITCHER_PROFILE_ID = "sdE6odSmnO";

const TRACKING_SNIPPET = `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_MEASUREMENT_ID}');
</script>
<!-- X conversion tracking base code -->
<script>
!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
twq('config','${X_PIXEL_ID}');
</script>
<!-- Snitcher visitor identification -->
<script>
!function(e){"use strict";var t=e&&e.namespace;if(t&&e.profileId&&e.cdn){var i=window[t];if(i&&Array.isArray(i)||(i=window[t]=[]),!i.initialized&&!i._loaded)if(i._loaded)console&&console.warn("[Radar] Duplicate initialization attempted");else{i._loaded=!0;["track","page","identify","group","alias","ready","debug","on","off","once","trackClick","trackSubmit","trackLink","trackForm","pageview","screen","reset","register","setAnonymousId","addSourceMiddleware","addIntegrationMiddleware","addDestinationMiddleware","giveCookieConsent"].forEach((function(e){var a;i[e]=(a=e,function(){var e=window[t];if(e.initialized)return e[a].apply(e,arguments);var i=[].slice.call(arguments);return i.unshift(a),e.push(i),e})})),-1===e.apiEndpoint.indexOf("http")&&(e.apiEndpoint="https://"+e.apiEndpoint),i.bootstrap=function(){var t,i=document.createElement("script");i.async=!0,i.type="text/javascript",i.id="__radar__",i.setAttribute("data-settings",JSON.stringify(e)),i.src=[-1!==(t=e.cdn).indexOf("http")?"":"https://",t,"/releases/latest/radar.min.js"].join("");var a=document.scripts[0];a.parentNode.insertBefore(i,a)},i.bootstrap()}}else"undefined"!=typeof console&&console.error("[Radar] Configuration incomplete")}({
  "apiEndpoint": "radar.snitcher.com",
  "cdn": "cdn.snitcher.com",
  "namespace": "Snitcher",
  "profileId": "${SNITCHER_PROFILE_ID}"
});
</script>
<!-- End tracking tags (injected by inject-tracking.js) -->`;

function walkHtmlFiles(dir, onFile) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(fullPath, onFile);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      onFile(fullPath);
    }
  }
}

function main() {
  if (!fs.existsSync(SITE_DIR)) {
    console.log("No _site/ folder found — run eleventy + copy-static.js first. Skipping tracking injection.");
    return;
  }

  let injected = 0;
  let skipped = 0;

  walkHtmlFiles(SITE_DIR, (filePath) => {
    const html = fs.readFileSync(filePath, "utf-8");

    // Idempotent: if this file somehow already has the tag (e.g. a stray
    // manual paste), don't double up.
    if (html.includes(GA_MEASUREMENT_ID)) {
      skipped++;
      return;
    }

    if (!html.includes("<head>")) {
      console.log(`  Skipped (no <head> tag): ${path.relative(SITE_DIR, filePath)}`);
      skipped++;
      return;
    }

    const updated = html.replace("<head>", `<head>${TRACKING_SNIPPET}`);
    fs.writeFileSync(filePath, updated);
    injected++;
  });

  console.log(`Injected tracking tags into ${injected} page(s)${skipped ? `, skipped ${skipped}` : ""}.`);
}

main();
