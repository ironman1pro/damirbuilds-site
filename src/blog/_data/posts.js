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
      noindex
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
