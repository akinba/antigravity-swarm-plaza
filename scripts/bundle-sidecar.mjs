import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.resolve(repoRoot, 'plugin/sidecars/swarm_plaza/dist');
const clientSrc = path.resolve(repoRoot, 'dist/client');
const clientDest = path.resolve(outDir, 'client');

fs.mkdirSync(outDir, { recursive: true });

console.log('[bundle-sidecar] Bundling src/sidecarEntry.ts -> plugin/sidecars/swarm_plaza/dist/server.cjs ...');
await esbuild.build({
  entryPoints: [path.resolve(repoRoot, 'src/sidecarEntry.ts')],
  outfile: path.resolve(outDir, 'server.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['node:*', 'bufferutil', 'utf-8-validate'],
  logLevel: 'info',
});

if (fs.existsSync(clientSrc)) {
  console.log('[bundle-sidecar] Copying dist/client -> plugin/sidecars/swarm_plaza/dist/client ...');
  if (fs.existsSync(clientDest)) {
    fs.rmSync(clientDest, { recursive: true, force: true });
  }
  fs.cpSync(clientSrc, clientDest, { recursive: true });
  console.log('[bundle-sidecar] Client assets copied successfully.');
} else {
  console.warn('[bundle-sidecar] Warning: dist/client not found. Make sure vite build ran first!');
}

console.log('[bundle-sidecar] Sidecar bundle completed successfully.');
