module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/blog/assets");

  eleventyConfig.addFilter("readableDate", (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  });

  return {
    dir: {
      input: "src/blog",
      includes: "_includes",
      output: "_site/blog"
    },
    dataTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};