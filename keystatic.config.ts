import { config, fields, collection } from '@keystatic/core';

export default config({
  storage: {
    kind: 'local',
  },

  collections: {
    posts: collection({
      label: 'Blog Posts',
      slugField: 'title',
      path: 'src/content/posts/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        date: fields.date({
          label: 'Publish Date',
          validation: { isRequired: true },
        }),
        category: fields.text({
          label: 'Category',
          validation: { isRequired: true },
        }),
        image: fields.url({
          label: 'Featured Image URL',
          validation: { isRequired: true },
        }),
        excerpt: fields.text({
          label: 'Excerpt',
          multiline: true,
          validation: { isRequired: true },
        }),
        content: fields.markdoc({
          label: 'Content',
        }),
      },
    }),
  },
});
