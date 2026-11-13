#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT as DEFAULT_PORT } from './server/config.js';
import { createPlazaApp } from './server/index.js';

export interface CliOptions {
  port: number;
  demo: boolean;
  open: boolean;
  workspace?: string;
  installPlugin: boolean;
  help: boolean;
  version: boolean;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    port: DEFAULT_PORT,
    demo: false,
    open: true,
    installPlugin: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      options.version = true;
    } else if (arg === '--demo') {
      options.demo = true;
    } else if (arg === '--no-open') {
      options.open = false;
    } else if (arg === '--install-plugin') {
      options.installPlugin = true;
    } else if (arg === '--port' || arg === '-p') {
      const next = argv[++i];
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 65535) {
        options.port = Math.floor(parsed);
      }
    } else if (arg.startsWith('--port=')) {
      const parsed = Number(arg.slice('--port='.length));
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 65535) {
        options.port = Math.floor(parsed);
      }
    } else if (arg === '--workspace' || arg === '-w') {
      const next = argv[++i];
      if (next) options.workspace = next;
    } else if (arg.startsWith('--workspace=')) {
      const val = arg.slice('--workspace='.length);
      if (val) options.workspace = val;
    }
  }

  return options;
}

function getPackageRoot(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidate1 = path.resolve(__dirname, '..');
  if (fs.existsSync(path.join(candidate1, 'package.json'))) {
    return candidate1;
  }
  return path.resolve(__dirname, '../..');
}

function getPackageVersion(): string {
  try {
    const pkgPath = path.join(getPackageRoot(), 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version || '1.1.0';
  } catch {
    return '1.1.0';
  }
}

export function installPlugin(targetBaseDir?: string): string {
  const pkgRoot = getPackageRoot();
  const sourceDir = path.join(pkgRoot, 'plugin');
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Bundled plugin directory not found at ${sourceDir}`);
  }

  const configRoot = targetBaseDir ?? path.join(os.homedir(), '.gemini', 'config');
  const destDir = path.join(configRoot, 'plugins', 'antigravity-swarm-plaza');
  fs.mkdirSync(destDir, { recursive: true });
  fs.cpSync(sourceDir, destDir, { recursive: true, force: true });
  return destDir;
}

export function openBrowser(url: string): void {
  try {
    if (process.platform === 'win32') {
      const child = spawn('cmd', ['/c', 'start', '', url], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    } else if (process.platform === 'darwin') {
      const child = spawn('open', [url], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    } else {
      const child = spawn('xdg-open', [url], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    }
  } catch {
    // Ignore browser launch failures in headless environments
  }
}

function printHelp(): void {
  console.log(`antigravity-swarm-plaza v${getPackageVersion()}

Usage:
  npx antigravity-swarm-plaza [options]

Options:
  -p, --port <n>         Port to listen on (default: ${DEFAULT_PORT})
      --demo             Start with Demo Penthouse floor enabled
      --no-open          Do not automatically open the browser
  -w, --workspace <path> Highlight a specific workspace floor
      --install-plugin   Copy bundled Antigravity plugin to ~/.gemini/config/plugins/
  -v, --version          Show version number
  -h, --help             Show this help message`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseCliArgs(argv);

  if (opts.help) {
    printHelp();
    return;
  }

  if (opts.version) {
    console.log(getPackageVersion());
    return;
  }

  if (opts.installPlugin) {
    const destDir = installPlugin();
    console.log(`[antigravity-swarm-plaza] Plugin installed to ${destDir}`);
    return;
  }

  const instance = createPlazaApp({
    initialDemoMode: opts.demo,
    currentWorkspace: opts.workspace,
  });

  await new Promise<void>((resolve) => {
    instance.server.listen(opts.port, () => {
      const url = `http://localhost:${opts.port}`;
      console.log(`[antigravity-swarm-plaza] Server listening on ${url}`);
      if (opts.open) {
        openBrowser(url);
      }
      resolve();
    });
  });

  const shutdown = () => {
    void instance.close().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function checkIsMainModule(): boolean {
  if (typeof process.argv[1] !== 'string') return false;
  try {
    const realArgv1 = fs.realpathSync(path.resolve(process.argv[1]));
    const selfPath = fs.realpathSync(fileURLToPath(import.meta.url));
    return realArgv1 === selfPath;
  } catch {
    return false;
  }
}

if (checkIsMainModule()) {
  void main().catch((err) => {
    console.error('[antigravity-swarm-plaza] Fatal error:', err);
    process.exit(1);
  });
}
