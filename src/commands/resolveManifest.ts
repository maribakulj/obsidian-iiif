import { type App, Notice } from "obsidian";
import { fetchJson, ManifestFetchError } from "../core/http/fetcher.ts";
import { IIIFParseError, parseManifest } from "../core/iiif/parser.ts";
import type { IIIFManifest } from "../core/iiif/types.ts";
import type { IIIFSettings } from "../settings/types.ts";

/**
 * Look for `iiif_manifest` in the active note's frontmatter and, if
 * present, fetch and parse it. Returns null when there is no active
 * note, no frontmatter field, or the fetch fails (a Notice is shown
 * in the failure case so the caller can silently fall back to a URL
 * prompt).
 */
export async function resolveManifestFromActiveNote(
  app: App,
  settings: IIIFSettings,
): Promise<IIIFManifest | null> {
  const file = app.workspace.getActiveFile();
  if (!file) return null;
  const fm = app.metadataCache.getFileCache(file)?.frontmatter;
  const url = fm?.["iiif_manifest"];
  if (typeof url !== "string" || url.trim().length === 0) return null;
  try {
    const raw = await fetchJson(url);
    return parseManifest(raw, { preferredLanguages: settings.preferredLanguages });
  } catch (e) {
    new Notice(
      `Could not reuse manifest from frontmatter (${formatError(e)}). ` +
        "Please paste a URL instead.",
    );
    return null;
  }
}

function formatError(e: unknown): string {
  if (e instanceof ManifestFetchError) return `fetch: ${e.message}`;
  if (e instanceof IIIFParseError) return `parse: ${e.message}`;
  if (e instanceof Error) return e.message;
  return "unknown error";
}
