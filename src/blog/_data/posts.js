const { createClient } = require("@sanity/client");
const { toHTML } = require("@portabletext/to-html");
const { createImageUrlBuilder } = require("@sanity/image-url");

const client = createClient({
  projectId: "ey1ylwzy",
  dataset: "production",
  apiVersion: "2026-01-01",
  useCdn: false
});

const builder = createImageUrlBuilder(client);
const SITE_SUFFIX = "damirbuilds";

module.exports = async function () {
  const posts = await client.fetch(`
    *[_type == "post" && defined(slug.current)]{
      title,
      "slug": slug.current,
      excerpt,
      publishedAt,
      "updatedAt": _updatedAt,
      mainImage,
      faqs,
      body,
      seo
    } | order(publishedAt desc)
  `);

  return posts.map(post => {
    // Table-of-contents: collect h2/h3 headings as they're rendered so
    // base.njk can build an "On this page" list without re-parsing HTML.
    const headings = [];
    const usedSlugs = {};
    const makeHeadingId = (value) => {
      const text = extractText(value);
      let slug = slugify(text) || "section";
      if (usedSlugs[slug] != null) {
        usedSlugs[slug] += 1;
        slug = `${slug}-${usedSlugs[slug]}`;
      } else {
        usedSlugs[slug] = 0;
      }
      return { text, slug };
    };

    const bodyHTML = post.body
      ? toHTML(post.body, {
          components: {
            types: {
              image: ({ value }) =>
                `<img src="${builder.image(value).width(1000).url()}" alt="${escapeAttr(value.alt || "")}" loading="lazy">`
            },
            marks: {
              link: ({ children, value }) =>
                `<a href="${value.href}" target="_blank" rel="noopener">${children}</a>`
            },
            block: {
              h2: ({ value, children }) => {
                const { text, slug } = makeHeadingId(value);
                headings.push({ text, slug, level: 2 });
                return `<h2 id="${slug}">${children}</h2>`;
              },
              h3: ({ value, children }) => {
                const { text, slug } = makeHeadingId(value);
                headings.push({ text, slug, level: 3 });
                return `<h3 id="${slug}">${children}</h3>`;
              }
            }
          }
        })
      : "";

    const plainText = bodyHTML.replace(/<[^>]+>/g, " ");
    const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
    const readingTime = wordCount ? Math.max(1, Math.round(wordCount / 200)) : null;

    const imageUrl = post.mainImage ? builder.image(post.mainImage).width(1200).url() : null;
    const mainImageAlt = (post.mainImage && post.mainImage.alt) || post.title;

    // SEO fields: prefer the per-post "seo" overrides in Sanity, falling
    // back to the display title/excerpt/main image so nothing is ever blank.
    const rawTitle = (post.seo && post.seo.seoTitle) || post.title;
    const seoTitle = rawTitle && !rawTitle.includes(SITE_SUFFIX)
      ? `${rawTitle} | ${SITE_SUFFIX}`
      : rawTitle;
    const seoDescription = (post.seo && post.seo.seoDescription) || post.excerpt || "";
    const socialImageUrl = post.seo && post.seo.seoImage
      ? builder.image(post.seo.seoImage).width(1200).url()
      : imageUrl;
    const noindex = !!(post.seo && post.seo.noindex);

    return {
      ...post,
      bodyHTML,
      wordCount,
      readingTime,
      imageUrl,
      mainImageAlt,
      seoTitle,
      seoDescription,
      socialImageUrl,
      noindex,
      headings
    };
  });
};

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function extractText(node) {
  if (!node || !node.children) return "";
  return node.children.map(c => c.text || "").join("");
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
