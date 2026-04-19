import { type App, Notice, normalizePath, TFile } from "obsidian";
import { buildAnnotationPage, serializeAnnotationPage } from "../core/annotation/build.ts";
import { extractIIIFEmbeds, stripFrontmatter } from "../core/annotation/extract.ts";
import { fetchJson, ManifestFetchError } from "../core/http/fetcher.ts";
import { IIIFParseError, parseManifest } from "../core/iiif/parser.ts";
import { uniquify } from "../core/note/filename.ts";
import type { IIIFSettings } from "../settings/types.ts";

export interface ExportAnnotationsContext {
  app: App;
  settings: IIIFSettings;
}

/**
 * Walk the active note for IIIF region/canvas embeds, fetch the
 * manifest declared in `iiif_manifest`, build a W3C AnnotationPage,
 * and write it next to the note as `<noteStem>.annotations.json`.
 * Existing files are uniquified (`-1`, `-2`, …).
 */
export async function runExportAnnotations(ctx: ExportAnnotationsContext): Promise<void> {
  const { app, settings } = ctx;
  const file = app.workspace.getActiveFile();
  if (!file || file.extension !== "md") {
    new Notice("Open a IIIF note first.");
    return;
  }
  const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
  const manifestUrl = fm["iiif_manifest"];
  if (typeof manifestUrl !== "string" || manifestUrl.trim().length === 0) {
    new Notice("This note has no `iiif_manifest` frontmatter field.");
    return;
  }

  const content = await app.vault.read(file);
  const embeds = extractIIIFEmbeds(stripFrontmatter(content));
  if (embeds.length === 0) {
    new Notice("No IIIF region/canvas embeds found in this note.");
    return;
  }

  const notice = new Notice("Fetching manifest…", 0);
  let manifest;
  try {
    const raw = await fetchJson(manifestUrl);
    manifest = parseManifest(raw, { preferredLanguages: settings.preferredLanguages });
  } catch (e) {
    notice.hide();
    new Notice(formatError(e));
    return;
  }
  notice.hide();

  const result = buildAnnotationPage(embeds, manifest, { manifestUrl });
  if (result.page.items.length === 0) {
    new Notice(
      `No embeds matched the manifest's canvases. ${result.unmatched} unmatched.`,
    );
    return;
  }

  const folder = file.parent?.path ?? "";
  const baseName = `${file.basename}.annotations.json`;
  const targetPath = normalizePath(
    uniquify(
      folder ? `${folder}/${baseName}` : baseName,
      (p) => app.vault.getAbstractFileByPath(p) != null,
    ),
  );
  const json = serializeAnnotationPage(result.page);
  const written = await app.vault.create(targetPath, json);
  const summary = `Exported ${result.page.items.length} annotation${result.page.items.length === 1 ? "" : "s"}` +
    (result.unmatched > 0 ? ` (${result.unmatched} embed${result.unmatched === 1 ? "" : "s"} unmatched)` : "") +
    ` → ${(written as TFile).path}`;
  new Notice(summary);
}

function formatError(e: unknown): string {
  if (e instanceof ManifestFetchError) return `Fetch failed: ${e.message}`;
  if (e instanceof IIIFParseError) return `Parse failed: ${e.message}`;
  if (e instanceof Error) return e.message;
  return "Unknown error";
}
