import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { GoogleDriveEntry } from '../shared/types.js';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MANIFEST_FILENAME = '.swarm-gdrive-manifest.json';
const MAX_TEXT_FILE_BYTES = 10 * 1024 * 1024;

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', '.next', 'target']);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.pdf',
  '.zip',
  '.gz',
  '.tar',
  '.7z',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp3',
  '.mp4',
  '.wav',
  '.webm',
  '.sqlite',
  '.db',
]);

export interface DriveManifestEntry {
  driveId: string;
  sha256: string;
  mimeType: string;
}

export interface DriveManifest {
  folderId: string;
  syncedAt: string;
  files: Record<string, DriveManifestEntry>;
}

function sha256Hex(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

function isLikelyTextFile(fileName: string, size?: number): boolean {
  if (typeof size === 'number' && size > MAX_TEXT_FILE_BYTES) return false;
  const ext = path.extname(fileName).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return false;
  return true;
}

function resolveSafeLocalPath(rootDir: string, relPath: string): string {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, relPath);
  const rel = path.relative(root, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Unsafe Drive relative path: ${relPath}`);
  }
  return resolved;
}

export async function listDriveEntries(
  accessToken: string,
  folderId = 'root',
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<GoogleDriveEntry[]> {
  const safeFolder = (folderId || 'root').replace(/['\\]/g, '');
  const q = encodeURIComponent(`'${safeFolder}' in parents and trashed = false`);
  const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,size)');
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=folder,name&pageSize=100`;

  const res = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Google Drive list failed (HTTP ${res.status} ${res.statusText})`);
  }

  const data = (await res.json()) as {
    files?: Array<{
      id?: string;
      name?: string;
      mimeType?: string;
      modifiedTime?: string;
      size?: string | number;
    }>;
  };

  return (data.files ?? [])
    .filter((f) => typeof f.id === 'string' && typeof f.name === 'string')
    .map((f) => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType || 'application/octet-stream',
      isFolder: f.mimeType === FOLDER_MIME,
      modifiedTime: f.modifiedTime,
      size:
        typeof f.size === 'number'
          ? f.size
          : typeof f.size === 'string'
            ? Number.parseInt(f.size, 10) || undefined
            : undefined,
    }));
}

export async function pullDriveFolder(
  accessToken: string,
  folderId: string,
  localTargetDir: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ downloaded: number; skipped: number; manifestPath: string }> {
  fs.mkdirSync(localTargetDir, { recursive: true });
  const manifest: DriveManifest = {
    folderId,
    syncedAt: new Date().toISOString(),
    files: {},
  };

  let downloaded = 0;
  let skipped = 0;

  async function walk(currentFolderId: string, relPrefix: string): Promise<void> {
    const entries = await listDriveEntries(accessToken, currentFolderId, fetchImpl);
    for (const entry of entries) {
      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (entry.isFolder) {
        if (SKIP_DIRS.has(entry.name)) {
          skipped += 1;
          continue;
        }
        const localSub = resolveSafeLocalPath(localTargetDir, relPath);
        fs.mkdirSync(localSub, { recursive: true });
        await walk(entry.id, relPath);
        continue;
      }

      if (
        entry.mimeType.startsWith('application/vnd.google-apps.') ||
        !isLikelyTextFile(entry.name, entry.size)
      ) {
        skipped += 1;
        continue;
      }

      const mediaRes = await fetchImpl(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(entry.id)}?alt=media`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (!mediaRes.ok) {
        skipped += 1;
        continue;
      }

      const contentBuf = Buffer.from(await mediaRes.arrayBuffer());
      if (contentBuf.byteLength > MAX_TEXT_FILE_BYTES || contentBuf.includes(0)) {
        skipped += 1;
        continue;
      }

      const localFile = resolveSafeLocalPath(localTargetDir, relPath);
      fs.mkdirSync(path.dirname(localFile), { recursive: true });
      fs.writeFileSync(localFile, contentBuf);
      manifest.files[relPath] = {
        driveId: entry.id,
        sha256: sha256Hex(contentBuf),
        mimeType: entry.mimeType,
      };
      downloaded += 1;
    }
  }

  await walk(folderId, '');
  const manifestPath = path.join(localTargetDir, MANIFEST_FILENAME);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return { downloaded, skipped, manifestPath };
}

function collectLocalTextFiles(rootDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string, relPrefix: string): void {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name === MANIFEST_FILENAME || SKIP_DIRS.has(item.name)) continue;
      const rel = relPrefix ? `${relPrefix}/${item.name}` : item.name;
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        walk(full, rel);
      } else if (item.isFile()) {
        const stat = fs.statSync(full);
        if (isLikelyTextFile(item.name, stat.size)) {
          results.push(rel);
        }
      }
    }
  }

  walk(rootDir, '');
  return results;
}

async function createDriveMultipartFile(
  accessToken: string,
  parentFolderId: string,
  fileName: string,
  content: Buffer,
  fetchImpl: typeof fetch,
): Promise<string> {
  const boundary = `swarm_drive_${Date.now()}`;
  const metadata = JSON.stringify({
    name: fileName,
    parents: [parentFolderId],
    mimeType: 'text/plain',
  });
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
    `${content.toString('utf8')}\r\n` +
    `--${boundary}--`;

  const res = await fetchImpl(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(`Google Drive create file failed (HTTP ${res.status})`);
  }
  const created = (await res.json()) as { id?: string };
  return created.id || `drive-${Date.now()}`;
}

export async function pushDriveFolder(
  accessToken: string,
  folderId: string,
  localTargetDir: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ uploaded: number; created: number; skipped: number }> {
  const manifestPath = path.join(localTargetDir, MANIFEST_FILENAME);
  let manifest: DriveManifest = {
    folderId,
    syncedAt: new Date().toISOString(),
    files: {},
  };
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as DriveManifest;
    } catch {
      // Reset malformed manifest
    }
  }

  const localFiles = collectLocalTextFiles(localTargetDir);
  let uploaded = 0;
  let created = 0;
  let skipped = 0;

  for (const relPath of localFiles) {
    const fullPath = resolveSafeLocalPath(localTargetDir, relPath);
    const buf = fs.readFileSync(fullPath);
    if (buf.includes(0)) {
      skipped += 1;
      continue;
    }
    const hash = sha256Hex(buf);
    const existing = manifest.files[relPath];

    if (existing && existing.sha256 === hash) {
      skipped += 1;
      continue;
    }

    if (existing) {
      const patchRes = await fetchImpl(
        `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.driveId)}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'text/plain; charset=utf-8',
          },
          body: buf,
        },
      );
      if (!patchRes.ok) {
        throw new Error(`Google Drive update failed for ${relPath} (HTTP ${patchRes.status})`);
      }
      manifest.files[relPath] = { ...existing, sha256: hash };
      uploaded += 1;
    } else {
      const fileName = path.posix.basename(relPath);
      const newId = await createDriveMultipartFile(
        accessToken,
        folderId,
        fileName,
        buf,
        fetchImpl,
      );
      manifest.files[relPath] = {
        driveId: newId,
        sha256: hash,
        mimeType: 'text/plain',
      };
      created += 1;
    }
  }

  manifest.syncedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return { uploaded, created, skipped };
}
