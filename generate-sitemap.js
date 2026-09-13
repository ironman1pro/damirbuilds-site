// Runs after `eleventy` and `copy-static.js` as part of `npm run build`.
// Queries Sanity for every published post's slug + last-modified time,
// combines that with the static marketing pages, and writes _site/sitemap.xml.

const fs = require("fs");
const path = require("path");
const { createClient } = require("@sanity/client");

const SITE_URL = "https://damirbuilds.com";

const client = createClient({
  projectId: "ey1ylwzy",
  dataset: "production",
  apiVersion: "2026-01-01",
  useCdn: false
});

// Static (non-blog) pages. changefreq/priority are gentle defaults —
// search engines treat these as hints, not rules.
const STATIC_ROUTES = [
  { url: "/", changefreq: "weekly", priority: "1.0" },
  { url: "/speed-to-lead", changefreq: "monthly", priority: "0.8" },
  { url: "/x-content-publisher", changefreq: "monthly", priority: "0.7" },
  { url: "/contact", changefreq: "monthly", priority: "0.5" },
  { url: "/industries", changefreq: "monthly", priority: "0.6" },
  { url: "/blog/", changefreq: "daily", priority: "0.9" }
];

function xmlEscape(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function main() {
  const posts = await client.fetch(`
    *[_type == "post" && defined(slug.current) && !(seo.noindex == true)]{
      "slug": slug.current,
      "updatedAt": _updatedAt,
      publishedAt
    }
  `);

  const now = new Date().toISOString();

  const urlEntries = [
    ...STATIC_ROUTES.map(route => ({
      loc: `${SITE_URL}${route.url}`,
      lastmod: now,
      changefreq: route.changefreq,
      priority: route.priority
    })),
    ...posts.map(post => ({
      loc: `${SITE_URL}/blog/${post.slug}/`,
      lastmod: new Date(post.updatedAt || post.publishedAt || now).toISOString(),
      changefreq: "monthly",
      priority: "0.7"
    }))
  ];

  const body = urlEntries
    .map(
      entry => `  <url>
    <loc>${xmlEscape(entry.loc)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

  const outDir = path.join(__dirname, "_site");
  if (!fs.existsSync(outDir)) {
    console.log("No _site/ folder found — run `eleventy` before generate-sitemap.js. Skipping.");
    return;
  }
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), xml);
  console.log(`Wrote sitemap.xml with ${urlEntries.length} URLs.`);
}

main().catch(err => {
  console.error("generate-sitemap.js failed:", err);
  // Don't fail the whole build over a sitemap hiccup (e.g. Sanity
  // temporarily unreachable) — just warn loudly.
  process.exitCode = 0;
});
