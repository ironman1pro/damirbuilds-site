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

// Maps the `linkedOffer` select value (set in Sanity Studio) to the actual
// marketing page + button copy. These are fixed static pages, not Sanity
// documents, so this lookup — not a reference field — is the source of
// truth for the URL. Add a new offer here first if you ever add one in
// the schema's options.list.
const OFFERS = {
  "speed-to-lead": { url: "/speed-to-lead", label: "See the Speed-to-Lead automation" },
  "x-content-publisher": { url: "/x-content-publisher", label: "See the X Content Publisher automation" },
  "ebook": { url: "/speed-to-lead-ebook", label: "Get the $19 ebook" }
};

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
      seo,
      funnelStage,
      linkedOffer,
      "recommendedNextStep": recommendedNextStep->{
        title,
        excerpt,
        "slug": slug.current
      },
      "relatedPosts": relatedPosts[]->{
        title,
        excerpt,
        "slug": slug.current
      }
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

    // The post-cover hero is the confirmed LCP element on post pages (see
    // PageSpeed Insights), but it's displayed at most ~836px wide on desktop
    // and as little as ~350px on mobile — not the flat 1200px every post was
    // requesting from Sanity. Build a real responsive srcset (auto-format so
    // Sanity serves WebP/AVIF where the browser supports it) instead of
    // shipping one oversized PNG/JPG that the browser just scales down with
    // CSS. `imageUrl` stays as the single fallback src (also used for the
    // BlogPosting JSON-LD "image").
    const IMAGE_WIDTHS = [400, 600, 800, 1000, 1200];
    const imageUrl = post.mainImage ? builder.image(post.mainImage).width(1200).auto("format").url() : null;
    const imageSrcset = post.mainImage
      ? IMAGE_WIDTHS.map(w => `${builder.image(post.mainImage).width(w).auto("format").url()} ${w}w`).join(", ")
      : null;
    const mainImageAlt = (post.mainImage && post.mainImage.alt) || post.title;

    // SEO fields: prefer the per-post "seo" overrides in Sanity, falling
    // back to the display title/excerpt/main image so nothing is ever blank.
    const rawTitle = (post.seo && post.seo.seoTitle) || post.title;
    const seoTitle = rawTitle && !rawTitle.includes(SITE_SUFFIX)
      ? `${rawTitle} | ${SITE_SUFFIX}`
      : rawTitle;
    const seoDescription = (post.seo && post.seo.seoDescription) || post.excerpt || "";
    // Social crawlers (Facebook/LinkedIn/X) don't reliably handle WebP/AVIF,
    // so og:image/twitter:image always get an explicit JPEG rather than the
    // auto-format URL used for the on-page <img srcset>.
    const socialImageUrl = post.seo && post.seo.seoImage
      ? builder.image(post.seo.seoImage).width(1200).format("jpg").url()
      : post.mainImage
        ? builder.image(post.mainImage).width(1200).format("jpg").url()
        : null;
    const noindex = !!(post.seo && post.seo.noindex);

    // Resolve the BOFU `linkedOffer` select value to an actual URL/label.
    // Falls back to null (template just won't render an offer CTA) if a
    // BOFU post somehow has no offer set or an unrecognized value.
    const linkedOfferData = post.linkedOffer ? OFFERS[post.linkedOffer] || null : null;

    return {
      ...post,
      linkedOfferData,
      bodyHTML,
      wordCount,
      readingTime,
      imageUrl,
      imageSrcset,
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
