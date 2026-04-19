import { normalizePath, requestUrl, type Vault, TFile, TFolder } from "obsidian";
import { computeSnapshotPath } from "./paths.ts";

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

export interface SnapshotResult {
  /** Vault-relative path where the snapshot was written. */
  vaultPath: string;
  /** Embed-ready path relative to the note's parent folder. */
  embedPath: string;
  /** Size of the saved file, in bytes. */
  bytes: number;
}

/**
 * Download a thumbnail URL via Obsidian's `requestUrl` and persist it
 * as a vault attachment. Returns both the full vault path (for later
 * cleanup/refresh) and an embed-ready relative path (for the note
 * body). Overwrites an existing file at the target path.
 */
export async function snapshotThumbnailToVault(args: {
  vault: Vault;
  remoteUrl: string;
  attachmentFolder: string;
  noteStem: string;
  noteFolder: string;
}): Promise<SnapshotResult> {
  const { vault, remoteUrl, attachmentFolder, noteStem, noteFolder } = args;
  const paths = computeSnapshotPath({ attachmentFolder, noteStem, remoteUrl });
  const fullPath = normalizePath(paths.fullPath);

  const buffer = await downloadBinary(remoteUrl);
  await ensureAttachmentFolder(vault, attachmentFolder);
  await writeOrOverwrite(vault, fullPath, buffer);

  return {
    vaultPath: fullPath,
    embedPath: paths.relativeFromNote(noteFolder),
    bytes: buffer.byteLength,
  };
}

async function downloadBinary(url: string): Promise<ArrayBuffer> {
  let res;
  try {
    res = await requestUrl({ url, method: "GET", throw: false });
  } catch (e) {
    throw new SnapshotError(`Network error fetching ${url}: ${(e as Error).message}`);
  }
  if (res.status >= 400) {
    throw new SnapshotError(`HTTP ${res.status} on ${url}`);
  }
  return res.arrayBuffer;
}

async function ensureAttachmentFolder(vault: Vault, raw: string): Promise<void> {
  const path = normalizePath(raw.replace(/^\/+|\/+$/g, ""));
  if (!path) return;
  const existing = vault.getAbstractFileByPath(path);
  if (existing instanceof TFolder) return;
  if (existing) {
    throw new SnapshotError(`Cannot create attachment folder: a file exists at ${path}`);
  }
  await vault.createFolder(path);
}

async function writeOrOverwrite(vault: Vault, path: string, data: ArrayBuffer): Promise<void> {
  const existing = vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await vault.modifyBinary(existing, data);
    return;
  }
  await vault.createBinary(path, data);
}
