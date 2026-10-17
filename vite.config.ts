import { defineConfig } from 'vite';

// The preview host is supplied per-VM by the host, so it is appended rather than
// hard-coded. Never use `allowedHosts: true` -- that would accept any Host header.
const extraHosts = (process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

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
});
