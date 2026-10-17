import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

// The preview host is supplied per-VM by the host, so it is appended rather than
// hard-coded. Never use `allowedHosts: true` -- that would accept any Host header.
const extraHosts = (process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

/**
 * Build id shown in the corner and baked into the service worker's cache name. On CI
 * this is the commit SHA, so the badge is a direct answer to "am I on the new deploy?".
 */
const BUILD_ID =
  (process.env.GITHUB_SHA ?? '').slice(0, 7) ||
  (process.env.BUILD_ID ?? `dev${Date.now().toString(36).slice(-4)}`);

function buildStamp(build: string): Plugin {
  return {
    name: 'build-stamp',
    transformIndexHtml(html) {
      return html.replaceAll('__BUILD_ID__', build);
    },
    // closeBundle runs after public/ has been copied into dist, so this rewrites the
    // deployed worker, not the source copy.
    closeBundle() {
      const file = fileURLToPath(new URL('./dist/sw.js', import.meta.url));
      const source = readFileSync(file, 'utf8');
      if (!source.includes('__BUILD__')) {
        throw new Error('dist/sw.js is missing its __BUILD__ placeholder');
      }
      writeFileSync(file, source.replaceAll('__BUILD__', build));
    },
  };
}

export default defineConfig({
  // Relative base so the build works on GitHub Pages project sites.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    ...(extraHosts.length > 0 ? { allowedHosts: extraHosts } : {}),
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  plugins: [buildStamp(BUILD_ID)],
});
