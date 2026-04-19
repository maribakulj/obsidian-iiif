import { type App, Notice, TFile } from "obsidian";
import { fetchJson, ManifestFetchError } from "../core/http/fetcher.ts";
import { diffManifests } from "../core/iiif/diff.ts";
import { IIIFParseError, parseManifest } from "../core/iiif/parser.ts";
import type { IIIFManifest } from "../core/iiif/types.ts";
import { enrichFrontmatter } from "../core/note/metadata-enrichment.ts";
import { pickHeaderThumbnailUrl } from "../core/note/thumbnail-selector.ts";
import type { IIIFSettings } from "../settings/types.ts";
import { RefreshSummaryModal } from "../ui/refresh-modal/RefreshSummaryModal.ts";

export interface RefreshContext {
  app: App;
  settings: IIIFSettings;
}

/**
 * Read `iiif_manifest` from the active note's frontmatter, re-fetch
 * and re-parse it, compute a diff against the stored values, and (on
 * user confirmation) update the frontmatter in place. The note body
 * is never mutated — the user decides what to do about structural
 * changes.
 */
export async function runRefreshManifest(ctx: RefreshContext): Promise<void> {
  const { app, settings } = ctx;
  const file = app.workspace.getActiveFile();
  if (!file || file.extension !== "md") {
    new Notice("Open a IIIF note first.");
    return;
  }
  const storedFm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
  const url = storedFm["iiif_manifest"];
  if (typeof url !== "string" || url.trim().length === 0) {
    new Notice("This note has no `iiif_manifest` frontmatter field.");
    return;
  }

  let fresh: IIIFManifest;
  const notice = new Notice("Fetching manifest…", 0);
  try {
    const raw = await fetchJson(url);
    fresh = parseManifest(raw, { preferredLanguages: settings.preferredLanguages });
  } catch (e) {
    notice.hide();
    new Notice(formatError(e));
    return;
  }
  notice.hide();

  const stored = synthesizeFromFrontmatter(storedFm, fresh);
  const diff = diffManifests(stored, fresh);

  new RefreshSummaryModal(app, file.basename, url, diff, async () => {
    await applyUpdate(app, file, fresh, settings);
    new Notice(diff.unchanged ? "Refresh: up to date." : "Refresh: frontmatter updated.");
  }).open();
}

/**
 * Build a minimal `IIIFManifest` from whatever the note's frontmatter
 * records. Used only for diffing — the result has the current label,
 * version, rights/provider/canvas_count, and a placeholder canvas
 * list so that structural diffs stay meaningful.
 */
function synthesizeFromFrontmatter(
  fm: Record<string, unknown>,
  fresh: IIIFManifest,
): IIIFManifest {
  const storedCanvasCount = asNumber(fm["canvas_count"]) ?? 0;
  // Reuse the fresh manifest's canvas ids so that a stale frontmatter
  // doesn't produce bogus "removed" entries. We treat fresh as source
  // of truth for canvas identity and only the scalar diffs stay useful
  // when canvas IDs weren't previously recorded.
  const pseudoCanvases = storedCanvasCount === fresh.canvases.length
    ? fresh.canvases
    : fresh.canvases.slice(0, storedCanvasCount);
  const label = typeof fm["title"] === "string" ? fm["title"] : fresh.label;
  const version = fm["iiif_version"] === "2" ? "2" : fm["iiif_version"] === "3" ? "3" : fresh.version;
  return {
    id: fresh.id,
    version,
    label,
    metadata: reconstructMetadata(fm),
    thumbnail: typeof fm["iiif_thumbnail"] === "string" ? fm["iiif_thumbnail"] : undefined,
    rights: typeof fm["rights"] === "string" ? fm["rights"] : undefined,
    provider: typeof fm["provider"] === "string" ? fm["provider"] : undefined,
    canvases: pseudoCanvases,
    rendering: [],
    seeAlso: [],
    raw: null,
  };
}

function reconstructMetadata(fm: Record<string, unknown>): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const keys = [
    "date",
    "place",
    "shelfmark",
    "creator",
    "subject",
    "language",
    "material",
    "extent",
    "period",
    "repository",
  ];
  for (const key of keys) {
    const v = fm[key];
    if (typeof v === "string" && v.length > 0) {
      out.push({ label: key, value: v });
    }
  }
  return out;
}

async function applyUpdate(
  app: App,
  file: TFile,
  fresh: IIIFManifest,
  settings: IIIFSettings,
): Promise<void> {
  await app.fileManager.processFrontMatter(file, (fm) => {
    fm.iiif_version = fresh.version;
    fm.title = fresh.label;
    fm.canvas_count = fresh.canvases.length;
    fm.imported = new Date().toISOString().slice(0, 10);
    const remoteThumb = pickHeaderThumbnailUrl(fresh, settings.thumbnailWidth);
    if (remoteThumb) fm.iiif_thumbnail = remoteThumb;
    if (fresh.provider) fm.provider = fresh.provider;
    else delete fm.provider;
    if (fresh.rights) fm.rights = fresh.rights;
    else delete fm.rights;
    for (const [key, value] of Object.entries(enrichFrontmatter(fresh.metadata))) {
      fm[key] = value;
    }
  });
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function formatError(e: unknown): string {
  if (e instanceof ManifestFetchError) return `Fetch failed: ${e.message}`;
  if (e instanceof IIIFParseError) return `Parse failed: ${e.message}`;
  if (e instanceof Error) return e.message;
  return "Unknown error";
}
