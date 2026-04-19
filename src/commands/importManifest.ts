import { App, normalizePath, Notice, TFile, TFolder, Vault, Workspace } from "obsidian";
import { buildManifestNote } from "../core/note/builder.ts";
import { buildFilename, sanitize, uniquify } from "../core/note/filename.ts";
import { pickHeaderThumbnailUrl } from "../core/note/thumbnail-selector.ts";
import { snapshotThumbnailToVault, SnapshotError } from "../core/snapshot/thumbnail.ts";
import type { IIIFManifest } from "../core/iiif/types.ts";
import type { IIIFSettings } from "../settings/types.ts";

export interface ImportContext {
  app: App;
  settings: IIIFSettings;
}

export interface ImportOptions {
  /**
   * Override the vault folder where the note is created (takes
   * precedence over `settings.folder`). Used by the collection
   * importer to colocate manifests with their index.
   */
  folderOverride?: string;
  /**
   * Parent collection context recorded in the manifest's frontmatter
   * for later Dataview navigation.
   */
  parentCollection?: {
    url: string;
    indexNoteStem: string;
  };
}

/**
 * Persist a parsed manifest as a Markdown note in the configured folder.
 * Returns the created file so callers can open it.
 */
export async function importManifestToVault(
  ctx: ImportContext,
  manifest: IIIFManifest,
  sourceUrl: string,
  opts: ImportOptions = {},
): Promise<TFile> {
  const { app, settings } = ctx;
  const folder = await ensureFolder(app.vault, opts.folderOverride ?? settings.folder);
  const stem = buildFilename(settings.filenameTemplate, manifest);
  const initial = `${folder ? folder + "/" : ""}${stem}.md`;
  const targetPath = uniquify(initial, (p) => app.vault.getAbstractFileByPath(p) != null);

  let headerThumbnailOverride: string | undefined;
  if (settings.snapshotThumbnails) {
    const remote = pickHeaderThumbnailUrl(manifest, settings.thumbnailWidth);
    if (remote) {
      try {
        const snap = await snapshotThumbnailToVault({
          vault: app.vault,
          remoteUrl: remote,
          attachmentFolder: settings.snapshotAttachmentFolder,
          noteStem: stem,
          noteFolder: folder,
        });
        headerThumbnailOverride = snap.embedPath;
      } catch (e) {
        const msg = e instanceof SnapshotError ? e.message : (e as Error).message;
        new Notice(`Thumbnail snapshot failed, keeping remote URL: ${msg}`);
      }
    }
  }

  const content = buildManifestNote(manifest, {
    manifestUrl: sourceUrl,
    importedAt: new Date(),
    thumbnailWidth: settings.thumbnailWidth,
    insertCanvasTable: settings.insertCanvasTable,
    maxCanvasesInTable: settings.maxCanvasesInTable,
    headerThumbnailOverride,
    parentCollection: opts.parentCollection,
  });

  const file = await app.vault.create(targetPath, content);
  return file;
}

/**
 * Open the freshly created note in a new pane (when settings allow).
 */
export async function openNoteIfRequested(
  workspace: Workspace,
  file: TFile,
  settings: IIIFSettings,
): Promise<void> {
  if (!settings.openAfterImport) return;
  const leaf = workspace.getLeaf(false);
  await leaf.openFile(file);
}

/**
 * High-level handler suitable for binding to the import modal.
 */
export async function handleImport(
  ctx: ImportContext,
  manifest: IIIFManifest,
  sourceUrl: string,
): Promise<void> {
  const file = await importManifestToVault(ctx, manifest, sourceUrl);
  new Notice(`Imported: ${file.basename}`);
  await openNoteIfRequested(ctx.app.workspace, file, ctx.settings);
}

export async function ensureFolder(vault: Vault, raw: string): Promise<string> {
  const path = normalizePath(sanitizeFolder(raw));
  if (path === "" || path === "/") return "";
  const existing = vault.getAbstractFileByPath(path);
  if (existing instanceof TFolder) return path;
  if (existing) {
    throw new Error(`Cannot create folder: a file already exists at ${path}`);
  }
  await vault.createFolder(path);
  return path;
}

export function sanitizeFolder(raw: string): string {
  // Allow nested folders; only sanitize each segment.
  return raw
    .split(/[\\/]+/)
    .map((seg) => sanitize(seg))
    .filter((s) => s.length > 0)
    .join("/");
}
