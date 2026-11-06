import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { resolveMetaPixelId } from './config/metaPixel';

/**
 * Meta pixel <noscript> fallback (a 1×1 PageView image for visitors without
 * JavaScript). Production builds only, so `vite dev` never reports to the
 * pixel. The JavaScript pixel itself lives in utils/metaPixel.ts; both read
 * the ID from config/metaPixel.ts (VITE_META_PIXEL_ID overrides). Every
 * prerendered route and the api/listing shell are built from this
 * index.html, so the fallback is on every page.
 */
function metaPixelNoscript(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const id = resolveMetaPixelId(env.VITE_META_PIXEL_ID || process.env.VITE_META_PIXEL_ID);
  const off = (env.VITE_META_PIXEL_DISABLED || process.env.VITE_META_PIXEL_DISABLED) === 'true';
  return {
    name: 'fyi-meta-pixel-noscript',
    apply: 'build',
    transformIndexHtml() {
      if (off) return [];
      return [{
        tag: 'noscript',
        injectTo: 'body-prepend',
        children: `<img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${id}&amp;ev=PageView&amp;noscript=1" />`,
      }];
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), metaPixelNoscript(mode)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3001,
  },
}));
