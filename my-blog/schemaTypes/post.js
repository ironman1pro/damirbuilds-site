import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'excerpt',
      title: 'Excerpt',
      description: 'Short summary shown on the blog listing card. Also used as the meta description when no SEO description is set below.',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.max(200).warning('Keep excerpts under ~200 characters so they read well as a card summary and meta description.'),
    }),
    defineField({
      name: 'author',
      title: 'Author',
      type: 'reference',
      to: {type: 'author'},
    }),
    defineField({
      name: 'mainImage',
      title: 'Main image',
      type: 'image',
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
          description: 'Describe the image for screen readers and search engines. Falls back to the post title if left blank.',
        },
      ],
    }),
    defineField({
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [{type: 'reference', to: {type: 'category'}}],
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'blockContent',
    }),
    defineField({
      name: 'funnelStage',
      title: 'Funnel stage',
      description: 'Where this post sits in the funnel. Controls which internal links and CTA get shown on the frontend.',
      type: 'string',
      options: {
        layout: 'radio',
        list: [
          {title: 'TOFU — Awareness', value: 'TOFU'},
          {title: 'MOFU — Consideration', value: 'MOFU'},
          {title: 'BOFU — Decision', value: 'BOFU'},
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'recommendedNextStep',
      title: 'Recommended next step',
      description: 'The one explicit "go deeper" link — the next post to push the reader toward (TOFU → its MOFU post, MOFU → its BOFU post). Rendered as a prominent "Read next" card, separate from Related posts below.',
      type: 'reference',
      to: [{type: 'post'}],
      validation: (Rule) =>
        Rule.custom((value, context) => {
          if (!value || !value._ref) return true
          const currentId = (context.document?._id || '').replace(/^drafts\./, '')
          const refId = value._ref.replace(/^drafts\./, '')
          if (currentId && currentId === refId) {
            return 'A post can’t be its own recommended next step.'
          }
          return true
        }),
    }),
    defineField({
      name: 'relatedPosts',
      title: 'Related posts',
      description: 'Up to 3 sideways/related posts, shown in a smaller related-content block. Remember the max-3-4-links-per-post rule when combined with Recommended next step.',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'post'}]}],
      validation: (Rule) =>
        Rule.max(3).custom((refs, context) => {
          if (!refs || !refs.length) return true
          const currentId = (context.document?._id || '').replace(/^drafts\./, '')
          const selfRef = refs.find((r) => r && r._ref && r._ref.replace(/^drafts\./, '') === currentId)
          if (selfRef) return 'A post can’t list itself in Related posts.'
          const refIds = refs.filter((r) => r && r._ref).map((r) => r._ref)
          const hasDuplicates = new Set(refIds).size !== refIds.length
          if (hasDuplicates) return 'Related posts contains a duplicate reference.'
          return true
        }),
    }),
    defineField({
      name: 'linkedOffer',
      title: 'Linked offer',
      description: 'For BOFU posts: which product/offer page this post pushes toward with a direct CTA button. These are fixed marketing pages, not Sanity documents, so pick from the list rather than referencing one.',
      type: 'string',
      options: {
        list: [
          {title: 'Speed-to-Lead automation', value: 'speed-to-lead'},
          {title: 'X Content Publisher automation', value: 'x-content-publisher'},
          {title: 'Speed-to-Lead Ebook ($19)', value: 'ebook'},
        ],
      },
      hidden: ({document}) => document?.funnelStage !== 'BOFU',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          if (context.document?.funnelStage === 'BOFU' && !value) {
            return 'BOFU posts should have a linked offer so the CTA has somewhere to send the reader.'
          }
          return true
        }).warning(),
    }),
    defineField({
      name: 'faqs',
      title: 'FAQs',
      description: 'Optional. Adds a Frequently Asked Questions section to the post, and generates FAQPage structured data for Google/AI answer engines.',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {name: 'question', type: 'string', title: 'Question'},
            {name: 'answer', type: 'text', title: 'Answer'},
          ],
        },
      ],
    }),
    defineField({
      name: 'seo',
      title: 'SEO',
      description: 'Optional overrides for search/social. Leave blank to fall back to the title, excerpt, and main image above.',
      type: 'object',
      options: {collapsible: true, collapsed: true},
      fields: [
        defineField({
          name: 'seoTitle',
          title: 'Meta title',
          type: 'string',
          description: 'Overrides the <title> tag and og:title. Aim for under ~60 characters.',
          validation: (Rule) => Rule.max(70).warning('Titles over ~60-70 characters get truncated in search results.'),
        }),
        defineField({
          name: 'seoDescription',
          title: 'Meta description',
          type: 'text',
          rows: 3,
          description: 'Overrides the meta description and og:description. Aim for under ~155 characters.',
          validation: (Rule) => Rule.max(200).warning('Descriptions over ~155-160 characters get truncated in search results.'),
        }),
        defineField({
          name: 'seoImage',
          title: 'Social share image',
          type: 'image',
          description: 'Overrides the image used for og:image/twitter:image. Falls back to the main image above.',
          options: {hotspot: true},
        }),
        defineField({
          name: 'noindex',
          title: 'Hide from search engines (noindex)',
          type: 'boolean',
          description: 'Turn on to keep this post out of Google/Bing while still publishing it (e.g. drafts you want to link privately).',
          initialValue: false,
        }),
      ],
    }),
  ],

  preview: {
    select: {
      title: 'title',
      author: 'author.name',
      media: 'mainImage',
    },
    prepare(selection) {
      const {author} = selection
      return {...selection, subtitle: author && `by ${author}`}
    },
  },
})
