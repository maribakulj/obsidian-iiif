import type { App, Editor } from "obsidian";
import type { IIIFSettings } from "../settings/types.ts";
import { CanvasBrowserModal } from "../ui/canvas-browser/CanvasBrowserModal.ts";
import { resolveManifestFromActiveNote } from "./resolveManifest.ts";

export interface InsertCanvasContext {
  app: App;
  settings: IIIFSettings;
}

/**
 * Entry point for the "Browse IIIF canvases" command. Behaves like
 * `runInsertRegion`: reuses the active note's manifest when available,
 * else prompts for a URL.
 */
export async function runInsertCanvas(
  ctx: InsertCanvasContext,
  editor: Editor,
): Promise<void> {
  const prefetched = await resolveManifestFromActiveNote(ctx.app, ctx.settings);
  new CanvasBrowserModal(ctx.app, ctx.settings, prefetched, (snippet) => {
    editor.replaceSelection(snippet);
  }).open();
}
