import { type App, normalizePath, Notice, TFile } from "obsidian";
import { fetchJson, ManifestFetchError } from "../core/http/fetcher.ts";
import { IIIFParseError, parseCollection, parseManifest } from "../core/iiif/parser.ts";
import type {
  IIIFCollection,
  IIIFCollectionEntry,
  IIIFManifest,
} from "../core/iiif/types.ts";
import { buildCollectionIndexNote, type CollectionImportReport } from "../core/note/collection-builder.ts";
import { buildFilename, sanitize } from "../core/note/filename.ts";
import { mapLimit } from "../core/util/map-limit.ts";
import type { IIIFSettings } from "../settings/types.ts";
import { ensureFolder, importManifestToVault } from "./importManifest.ts";

export const COLLECTION_CONCURRENCY = 3;

export interface CollectionImportContext {
  app: App;
  settings: IIIFSettings;
}

export type ProgressHandler = (done: number, total: number) => void;

export interface CollectionImportResult {
  reports: CollectionImportReport[];
  indexFile: TFile;
}

/**
 * Import every `Manifest` item of a IIIF Collection into its own note
 * under a dedicated subfolder, and create an index note at the folder
 * root linking to each of them. Sub-collections are listed in the
 * index but not recursively imported — the user can re-run the
 * command on each.
 */
export async function importCollection(
  ctx: CollectionImportContext,
  collection: IIIFCollection,
  collectionUrl: string,
  onProgress?: ProgressHandler,
): Promise<CollectionImportResult> {
  const rootFolder = await ensureFolder(ctx.app.vault, ctx.settings.folder);
  const folderStem = sanitize(collection.label) || "iiif-collection";
  const collectionFolder = await ensureFolder(
    ctx.app.vault,
    rootFolder ? `${rootFolder}/${folderStem}` : folderStem,
  );
  const indexStem = uniqueStem(
    ctx.app,
    collectionFolder,
    folderStem,
  );
  const indexPath = normalizePath(`${collectionFolder}/${indexStem}.md`);

  // First pass: import each Manifest item concurrently. We build the
  // initial index with placeholder reports so the file exists before
  // child notes are created (`collection_index` wiki-links resolve).
  const reports: CollectionImportReport[] = await mapLimit(
    collection.items,
    COLLECTION_CONCURRENCY,
    async (entry) => processEntry(ctx, entry, collectionUrl, indexStem, collectionFolder),
    onProgress,
  );

  const content = buildCollectionIndexNote(collection, {
    collectionUrl,
    importedAt: new Date(),
    reports,
  });
  const indexFile = await writeOrOverwrite(ctx.app, indexPath, content);
  return { reports, indexFile };
}

/** Run the full flow starting from a raw user-entered URL. */
export async function fetchAndImportCollection(
  ctx: CollectionImportContext,
  url: string,
  onProgress?: ProgressHandler,
): Promise<CollectionImportResult & { collection: IIIFCollection }> {
  const raw = await fetchJson(url);
  const collection = parseCollection(raw, {
    preferredLanguages: ctx.settings.preferredLanguages,
  });
  const result = await importCollection(ctx, collection, url, onProgress);
  return { ...result, collection };
}

async function processEntry(
  ctx: CollectionImportContext,
  entry: IIIFCollectionEntry,
  collectionUrl: string,
  indexStem: string,
  collectionFolder: string,
): Promise<CollectionImportReport> {
  if (entry.type !== "Manifest") {
    return { entry, status: "skipped" };
  }
  try {
    const manifest = await fetchAndParse(entry.id, ctx.settings.preferredLanguages);
    const file = await importManifestToVault(ctx, manifest, entry.id, {
      folderOverride: collectionFolder,
      parentCollection: { url: collectionUrl, indexNoteStem: indexStem },
    });
    return { entry, status: "imported", noteStem: file.basename };
  } catch (e) {
    return {
      entry,
      status: "failed",
      errorMessage: formatError(e),
    };
  }
}

async function fetchAndParse(
  url: string,
  preferredLanguages: string[],
): Promise<IIIFManifest> {
  const raw = await fetchJson(url);
  return parseManifest(raw, { preferredLanguages });
}

function uniqueStem(app: App, folder: string, base: string): string {
  const stem = base;
  const path = normalizePath(folder ? `${folder}/${stem}.md` : `${stem}.md`);
  if (!app.vault.getAbstractFileByPath(path)) return stem;
  for (let i = 1; i < 1000; i++) {
    const candidate = `${stem} ${i}`;
    const p = normalizePath(folder ? `${folder}/${candidate}.md` : `${candidate}.md`);
    if (!app.vault.getAbstractFileByPath(p)) return candidate;
  }
  throw new Error(`Could not find a unique name for collection index in ${folder}`);
}

async function writeOrOverwrite(app: App, path: string, content: string): Promise<TFile> {
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, content);
    return existing;
  }
  return await app.vault.create(path, content);
}

function formatError(e: unknown): string {
  if (e instanceof ManifestFetchError) return `fetch: ${e.message}`;
  if (e instanceof IIIFParseError) return `parse: ${e.message}`;
  if (e instanceof Error) return e.message;
  return "unknown error";
}

export function notifyFailures(reports: CollectionImportReport[]): void {
  const failed = reports.filter((r) => r.status === "failed");
  if (failed.length === 0) return;
  new Notice(
    `Imported with ${failed.length} failure${failed.length === 1 ? "" : "s"} — see the index note.`,
  );
}
