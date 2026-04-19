import type { App, Editor } from "obsidian";
import type { IIIFSettings } from "../settings/types.ts";
import { RegionPickerModal } from "../ui/region-picker/RegionPickerModal.ts";
import { resolveManifestFromActiveNote } from "./resolveManifest.ts";

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
  const prefetched = await resolveManifestFromActiveNote(ctx.app, ctx.settings);
  new RegionPickerModal(ctx.app, ctx.settings, prefetched, (snippet) => {
    editor.replaceSelection(snippet);
  }).open();
}
