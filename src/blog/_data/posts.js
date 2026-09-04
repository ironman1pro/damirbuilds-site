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

module.exports = async function () {
  const posts = await client.fetch(`
    *[_type == "post" && defined(slug.current)]{
      title,
      "slug": slug.current,
      excerpt,
      publishedAt,
      mainImage,
      faqs,
      body
    } | order(publishedAt desc)
  `);

  return posts.map(post => {
    const bodyHTML = post.body
      ? toHTML(post.body, {
          components: {
            types: {
              image: ({ value }) =>
                `<img src="${builder.image(value).width(1000).url()}" alt="" loading="lazy">`
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

    return {
      ...post,
      bodyHTML,
      readingTime,
      imageUrl: post.mainImage ? builder.image(post.mainImage).width(1200).url() : null
    };
  });
};