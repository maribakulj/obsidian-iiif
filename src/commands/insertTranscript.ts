import type { App, Editor } from "obsidian";
import type { IIIFSettings } from "../settings/types.ts";
import { InsertTranscriptModal } from "../ui/transcript-modal/InsertTranscriptModal.ts";
import { resolveManifestFromActiveNote } from "./resolveManifest.ts";

export interface InsertTranscriptContext {
  app: App;
  settings: IIIFSettings;
}

/**
 * Entry point for the "Insert IIIF transcript" command. Reuses the
 * active note's manifest via its `iiif_manifest` frontmatter when
 * available; otherwise the modal prompts for a URL.
 */
export async function runInsertTranscript(
  ctx: InsertTranscriptContext,
  editor: Editor,
): Promise<void> {
  const prefetched = await resolveManifestFromActiveNote(ctx.app, ctx.settings);
  new InsertTranscriptModal(ctx.app, ctx.settings, prefetched, (snippet) => {
    editor.replaceSelection(snippet);
  }).open();
}
