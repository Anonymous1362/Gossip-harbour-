/* Post-build check: the deployed shell and worker must agree on one build id.
 *
 * This is the check that would have caught the stale-service-worker bug: an unstamped
 * sw.js keeps a fixed cache name, so every deploy serves the old bundle until the user
 * clears storage. Run from `npm run build` after `vite build`.
 */
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const fail = (msg) => {
  console.error(`verify-build: ${msg}`);
  process.exit(1);
};

const html = read('../dist/index.html');
const sw = read('../dist/sw.js');

const badge = html.match(/id="build"[^>]*>([^<]+)</);
if (!badge) fail('dist/index.html has no #build badge');
const build = badge[1].trim();
if (!build || build.includes('__BUILD_ID__')) fail(`badge was not stamped: "${build}"`);

const swBuild = sw.match(/const BUILD = '([^']*)'/);
if (!swBuild) fail('dist/sw.js has no BUILD constant');
if (swBuild[1].includes('__BUILD__')) fail('dist/sw.js BUILD was not stamped');
if (swBuild[1] !== build) fail(`worker build "${swBuild[1]}" != badge "${build}"`);

if (!sw.includes('lantern-quay-${BUILD}')) fail('worker cache name is not versioned per build');
for (const needle of ['skipWaiting', 'clients.claim', "cache: 'no-store'", 'caches.delete']) {
  if (!sw.includes(needle)) fail(`worker is missing ${needle}`);
}

console.log(`verify-build: ok (build ${build}, versioned worker cache)`);
