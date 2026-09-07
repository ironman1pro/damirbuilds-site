// Runs after `eleventy` and `copy-static.js` as part of `npm run build`.
// Walks every .html file in _site/ (both the Eleventy-built blog pages and
// the copied static-site/ marketing pages) and injects the GA4 + X Ads
// tracking snippets right after each page's <head> tag.
//
// This is the single source of truth for site-wide tracking — the tags
// live ONLY here, not pasted into individual page source files. Add a new
// static page to static-site/, or a new blog post, and it gets tagged
// automatically the next time `npm run build` runs. No per-page edits,
// ever, for either tag.
//
// If you need to swap the GA4 measurement ID or the X pixel ID, change it
// once here and rebuild — every page picks it up.

const fs = require("fs");
const path = require("path");

const SITE_DIR = path.join(__dirname, "_site");

const GA_MEASUREMENT_ID = "G-H4KZPNKXEZ";
const X_PIXEL_ID = "reor2";

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
