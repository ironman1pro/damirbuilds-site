// Runs after `eleventy` and `copy-static.js` as part of `npm run build`.
// Writes _site/llms.txt following the llms.txt convention (llmstxt.org):
// a markdown file with one H1, a one-line summary, and linked sections
// so LLM tools/crawlers get a clean, low-noise map of the site instead
// of having to parse full HTML pages. Blog post links are pulled live
// from Sanity (same client config as generate-sitemap.js) so new posts
// show up here automatically on every build, no manual editing needed.

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

async function main() {
  const posts = await client.fetch(`
    *[_type == "post" && defined(slug.current) && !(seo.noindex == true)] | order(publishedAt desc){
      title,
      "slug": slug.current,
      excerpt
    }
  `);

  const postLines = posts.length
    ? posts
        .map(post => {
          const desc = post.excerpt ? `: ${post.excerpt}` : "";
          return `- [${post.title}](${SITE_URL}/blog/${post.slug}/)${desc}`;
        })
        .join("\n")
    : "- (No posts published yet — check /blog/ for the latest.)";

  const content = `# damirbuilds

> AI automation systems for business owners — speed-to-lead, lead routing, and lead reactivation, built to turn more inbound leads into paying customers.

Damir builds focused, revenue-first automations for small and mid-sized businesses, one business at a time, not through an agency. This file lists the site's key pages and blog posts for LLM tools and crawlers; it does not grant any permission beyond what /robots.txt already allows.

## Pages

- [Home](${SITE_URL}/): Overview of what Damir builds and why speed-to-lead matters.
- [Speed-to-Lead System](${SITE_URL}/speed-to-lead.html): The core service — instant lead response, routing, and reactivation.
- [Contact](${SITE_URL}/contact.html): Get in touch to start a project.
- [Blog](${SITE_URL}/blog/): Practical writing on lead response, automation, and what moves revenue.

## Blog posts

${postLines}
`;

  const outDir = path.join(__dirname, "_site");
  if (!fs.existsSync(outDir)) {
    console.log("No _site/ folder found — run `eleventy` before generate-llms-txt.js. Skipping.");
    return;
  }
  fs.writeFileSync(path.join(outDir, "llms.txt"), content);
  console.log(`Wrote llms.txt with ${posts.length} blog post link(s).`);
}

main().catch(err => {
  console.error("generate-llms-txt.js failed:", err);
  // Don't fail the whole build over this — just warn loudly, same as
  // generate-sitemap.js.
  process.exitCode = 0;
});
