import fs from 'node:fs';
import path from 'node:path';
import { BIND_HOST, resolveDefaultPort } from './server/config.js';
import { createPlazaServer } from './server/index.js';

const entryDir = process.argv[1]
  ? path.dirname(path.resolve(process.argv[1]))
  : process.cwd();

const clientCandidates = [
  path.join(entryDir, 'client'),
  path.resolve(entryDir, '../../../../dist/client'),
];

const clientDistDir =
  clientCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) ??
  clientCandidates[0];

const port = resolveDefaultPort();
const instance = createPlazaServer({ clientDistDir });

instance.server.listen(port, BIND_HOST, () => {
  console.log(`[antigravity-swarm-plaza-sidecar] listening on http://${BIND_HOST}:${port}`);
});

if (process.argv[1]) {
  const entryFile = path.resolve(process.argv[1]);
  fs.watchFile(entryFile, { interval: 2000, persistent: false }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      process.exit(0);
    }
  });
}

const shutdown = () => {
  void instance.close().then(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
