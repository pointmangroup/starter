import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import alpinejs from '@astrojs/alpinejs';
import keystatic from '@keystatic/astro';
import react from '@astrojs/react';
import markdoc from '@astrojs/markdoc';
import cloudflare from '@astrojs/cloudflare';

// eslint-disable-next-line no-undef
const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  site: 'https://fons-sprinkler-repair.com',
  integrations: [alpinejs(), keystatic(), react(), markdoc()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: isProd && {
        'react-dom/server': 'react-dom/server.edge',
      },
    },
  },
  output: 'server',
  adapter: cloudflare({
    functionPerRoute: false,
    mode: 'directory',
  }),
});
