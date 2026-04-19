import { type App, type Editor, Notice } from "obsidian";
import { fetchJson, ManifestFetchError } from "../core/http/fetcher.ts";
import { IIIFParseError, parseManifest } from "../core/iiif/parser.ts";
import type { IIIFManifest } from "../core/iiif/types.ts";
import type { IIIFSettings } from "../settings/types.ts";
import { RegionPickerModal } from "../ui/region-picker/RegionPickerModal.ts";

export interface InsertRegionContext {
  app: App;
  settings: IIIFSettings;
}

/**
 * Entry point for the "Insert IIIF region" command. If the active note
 * declares `iiif_manifest` in its frontmatter, we reuse it silently;
 * otherwise the modal prompts for a URL.
 */
export async function runInsertRegion(ctx: InsertRegionContext, editor: Editor): Promise<void> {
  const prefetched = await tryResolveFromFrontmatter(ctx);
  new RegionPickerModal(ctx.app, ctx.settings, prefetched, (snippet) => {
    editor.replaceSelection(snippet);
  }).open();
}

async function tryResolveFromFrontmatter(
  ctx: InsertRegionContext,
): Promise<IIIFManifest | null> {
  const file = ctx.app.workspace.getActiveFile();
  if (!file) return null;
  const fm = ctx.app.metadataCache.getFileCache(file)?.frontmatter;
  const url = fm?.["iiif_manifest"];
  if (typeof url !== "string" || url.trim().length === 0) return null;
  try {
    const raw = await fetchJson(url);
    return parseManifest(raw, { preferredLanguages: ctx.settings.preferredLanguages });
  } catch (e) {
    new Notice(
      `Could not reuse manifest from frontmatter (${formatErrorForUser(e)}). ` +
        "Please paste a URL in the picker.",
    );
    return null;
  }
}

function formatErrorForUser(e: unknown): string {
  if (e instanceof ManifestFetchError) return `fetch: ${e.message}`;
  if (e instanceof IIIFParseError) return `parse: ${e.message}`;
  if (e instanceof Error) return e.message;
  return "unknown error";
}
