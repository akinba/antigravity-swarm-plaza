import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { installPlugin, parseCliArgs } from '../../src/cli.js';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');

describe('CLI parseCliArgs', () => {
  it('returns sensible defaults when no arguments are passed', () => {
    const opts = parseCliArgs([]);
    assert.deepEqual(opts, {
      port: 3210,
      demo: false,
      open: true,
      installPlugin: false,
      help: false,
      version: false,
    });
  });

  it('parses --port 4000, --demo, --no-open, --workspace /foo, --install-plugin, and --help', () => {
    const opts = parseCliArgs([
      '--port',
      '4000',
      '--demo',
      '--no-open',
      '--workspace',
      '/foo',
      '--install-plugin',
      '--help',
    ]);
    assert.equal(opts.port, 4000);
    assert.equal(opts.demo, true);
    assert.equal(opts.open, false);
    assert.equal(opts.workspace, '/foo');
    assert.equal(opts.installPlugin, true);
    assert.equal(opts.help, true);
    assert.equal(opts.version, false);
  });

  it('supports equals syntax and short flags (-p, -w, -h, -v)', () => {
    const opts = parseCliArgs(['--port=5050', '--workspace=/bar', '-v']);
    assert.equal(opts.port, 5050);
    assert.equal(opts.workspace, '/bar');
    assert.equal(opts.version, true);

    const shortOpts = parseCliArgs(['-p', '8080', '-w', '/baz', '-h']);
    assert.equal(shortOpts.port, 8080);
    assert.equal(shortOpts.workspace, '/baz');
    assert.equal(shortOpts.help, true);
  });

  it('ignores out-of-range or non-numeric --port values', () => {
    assert.equal(parseCliArgs(['--port', '0']).port, 3210);
    assert.equal(parseCliArgs(['--port', '70000']).port, 3210);
    assert.equal(parseCliArgs(['--port', 'abc']).port, 3210);
  });
});

describe('Antigravity plugin bundle', () => {
  it('has a valid plugin/plugin.json manifest', () => {
    const manifestPath = path.join(ROOT_DIR, 'plugin', 'plugin.json');
    assert.equal(fs.existsSync(manifestPath), true, 'plugin/plugin.json must exist');

    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw) as Record<string, unknown>;
    assert.equal(typeof manifest.name, 'string');
    assert.ok((manifest.name as string).length > 0);
    assert.equal(typeof manifest.version, 'string');
    assert.ok((manifest.version as string).length > 0);
    assert.equal(typeof manifest.description, 'string');
    assert.ok((manifest.description as string).length > 0);
  });

  it('includes plugin/skills/swarm-plaza/SKILL.md and plugin/assets/logo.svg', () => {
    const skillPath = path.join(ROOT_DIR, 'plugin', 'skills', 'swarm-plaza', 'SKILL.md');
    const logoPath = path.join(ROOT_DIR, 'plugin', 'assets', 'logo.svg');

    assert.equal(fs.existsSync(skillPath), true, 'SKILL.md must exist');
    assert.equal(fs.existsSync(logoPath), true, 'logo.svg must exist');

    const skillContent = fs.readFileSync(skillPath, 'utf8');
    assert.ok(skillContent.includes('name: swarm-plaza'));

    const logoContent = fs.readFileSync(logoPath, 'utf8');
    assert.ok(logoContent.includes('<svg'));
  });

  it('includes plugin/rules/AGENTS.md without frontmatter and with companion sidecar URIs', () => {
    const rulePath = path.join(ROOT_DIR, 'plugin', 'rules', 'AGENTS.md');
    assert.equal(fs.existsSync(rulePath), true, 'plugin/rules/AGENTS.md must exist');

    const stat = fs.statSync(rulePath);
    assert.ok(stat.size > 0 && stat.size < 24_000);

    const content = fs.readFileSync(rulePath, 'utf8');
    assert.equal(content.trimStart().startsWith('---'), false);
    assert.ok(content.includes('sidecar://antigravity-swarm-plaza/swarm_plaza/'));
    assert.ok(content.includes('sidecar://swarm/swarm_board/'));
  });

  it('installPlugin copies rules, manifest, skill, and sidecar config to target directory', () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'plaza-install-test-'));
    try {
      const destDir = installPlugin(tmpBase);
      assert.equal(
        destDir,
        path.join(tmpBase, 'plugins', 'antigravity-swarm-plaza'),
      );
      assert.equal(fs.existsSync(path.join(destDir, 'plugin.json')), true);
      assert.equal(fs.existsSync(path.join(destDir, 'rules', 'AGENTS.md')), true);
      assert.equal(
        fs.existsSync(path.join(destDir, 'skills', 'swarm-plaza', 'SKILL.md')),
        true,
      );
      assert.equal(
        fs.existsSync(path.join(destDir, 'sidecars', 'swarm_plaza', 'sidecar.json')),
        true,
      );
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
