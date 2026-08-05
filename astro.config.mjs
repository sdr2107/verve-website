// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Absolute origin for canonical URLs and og:image. Social cards are the
  // reason this matters — X and iMessage both ignore relative image paths, so
  // the full origin has to be baked in at build time.
  site: 'https://verve-app.health',

  vite: {
    plugins: [tailwindcss()]
  }
});