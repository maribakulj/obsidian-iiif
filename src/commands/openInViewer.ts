import { type App, Notice, TFile } from "obsidian";
import { buildViewerUrl, ViewerConfigError } from "../core/viewer/url-builder.ts";
import type { IIIFSettings } from "../settings/types.ts";

export interface OpenInViewerContext {
  app: App;
  settings: IIIFSettings;
}

/**
 * Resolve the active note's `iiif_manifest` URL, render a deep link
 * for the configured viewer, and open it in the user's browser.
 */
export function runOpenInViewer(ctx: OpenInViewerContext): void {
  withManifestUrl(ctx, (manifestUrl) => {
    try {
      const { preset, url } = buildViewerUrl({
        kind: ctx.settings.externalViewer,
        customTemplate: ctx.settings.customViewerUrlTemplate,
        manifestUrl,
      });
      window.open(url, "_blank");
      new Notice(`Opening in ${preset.label}…`);
    } catch (e) {
      new Notice(formatError(e));
    }
  });
}

/**
 * Same URL construction, but copies the result to the clipboard
 * instead of opening a new window. Useful when the user wants to
 * paste the link into another app.
 */
export async function runCopyViewerLink(ctx: OpenInViewerContext): Promise<void> {
  const manifestUrl = readFrontmatterUrl(ctx);
  if (!manifestUrl) return;
  try {
    const { url } = buildViewerUrl({
      kind: ctx.settings.externalViewer,
      customTemplate: ctx.settings.customViewerUrlTemplate,
      manifestUrl,
    });
    await navigator.clipboard.writeText(url);
    new Notice("Viewer URL copied to clipboard.");
  } catch (e) {
    new Notice(formatError(e));
  }
}

function withManifestUrl(
  ctx: OpenInViewerContext,
  fn: (url: string) => void,
): void {
  const url = readFrontmatterUrl(ctx);
  if (url) fn(url);
}

function readFrontmatterUrl(ctx: OpenInViewerContext): string | null {
  const file = ctx.app.workspace.getActiveFile();
  if (!(file instanceof TFile) || file.extension !== "md") {
    new Notice("Open a IIIF note first.");
    return null;
  }
  const fm = ctx.app.metadataCache.getFileCache(file)?.frontmatter;
  const url = fm?.["iiif_manifest"];
  if (typeof url !== "string" || url.trim().length === 0) {
    new Notice("This note has no `iiif_manifest` frontmatter field.");
    return null;
  }
  return url.trim();
}

function formatError(e: unknown): string {
  if (e instanceof ViewerConfigError) return e.message;
  if (e instanceof Error) return e.message;
  return "Unknown error";
}
