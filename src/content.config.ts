import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
    author: z.string(),
    authorRole: z.string().optional(),
    authorAvatar: z.string().url().optional(),
    category: z.string(),
    excerpt: z.string(),
    image: z.string().url(),
  }),
});

export const collections = {
  posts,
};
