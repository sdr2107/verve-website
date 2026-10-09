// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
  // Absolute origin for canonical URLs and og:image. Social cards are the
  // reason this matters — X and iMessage both ignore relative image paths, so
  // the full origin has to be baked in at build time.
  site: 'https://verve-app.health',

  // The next page's HTML is fetched while the pointer rests on its link,
  // so the click shows the shell at once; My health asks for its data in
  // an inline script at the top of that HTML, which this brings forward too.
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },

  // My health's views are Preact components (src/my-health/views), a
  // function of the person's document; the marketing pages carry no runtime.
  integrations: [preact()],

  vite: {
    plugins: [tailwindcss()]
  }
});