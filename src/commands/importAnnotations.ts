import { type App, type Editor, Notice, TFile } from "obsidian";
import {
  AnnotationParseError,
  parseAnnotationDocument,
  type ParsedAnnotation,
} from "../core/annotation/parse.ts";
import { fetchJson, ManifestFetchError } from "../core/http/fetcher.ts";
import { buildImageUrl } from "../core/iiif/image-api.ts";
import { IIIFParseError, parseManifest } from "../core/iiif/parser.ts";
import type { IIIFManifest } from "../core/iiif/types.ts";
import { resolveManifestFromActiveNote } from "./resolveManifest.ts";
import type { IIIFSettings } from "../settings/types.ts";

export interface ImportAnnotationsContext {
  app: App;
  settings: IIIFSettings;
}

/**
 * Read an annotation document (vault path or URL), translate each
 * annotation back into a Markdown image embed pointing at the right
 * Image API URL for its canvas + region, and insert the lot at the
 * editor cursor in document order.
 *
 * Annotations whose target canvas can't be matched to a parsed
 * manifest are still inserted as blockquoted captions so the user
 * sees what was missed.
 */
export async function runImportAnnotations(
  ctx: ImportAnnotationsContext,
  editor: Editor,
  source: string,
): Promise<void> {
  const { app, settings } = ctx;
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    new Notice("Provide a vault path or URL pointing at an annotation file.");
    return;
  }

  let raw: unknown;
  try {
    raw = await readAnnotationSource(app, trimmed);
  } catch (e) {
    new Notice(formatError(e));
    return;
  }

  let parsed: ParsedAnnotation[];
  try {
    parsed = parseAnnotationDocument(raw);
  } catch (e) {
    new Notice(formatError(e));
    return;
  }
  if (parsed.length === 0) {
    new Notice("No annotations found in the document.");
    return;
  }

  const manifest = await resolveManifestForImport(ctx, parsed);
  const lines: string[] = [];
  let unmatched = 0;
  for (const a of parsed) {
    const embed = renderEmbed(a, manifest);
    if (embed) lines.push(embed);
    else {
      unmatched++;
      lines.push(renderFallback(a));
    }
  }
  editor.replaceSelection(lines.join("\n\n") + "\n");
  new Notice(
    `Inserted ${parsed.length} annotation${parsed.length === 1 ? "" : "s"}` +
      (unmatched > 0
        ? ` (${unmatched} without canvas match — see blockquotes)`
        : ""),
  );
}

async function readAnnotationSource(app: App, source: string): Promise<unknown> {
  if (/^https?:\/\//i.test(source)) {
    return await fetchJson(source);
  }
  const file = app.vault.getAbstractFileByPath(source);
  if (!(file instanceof TFile)) {
    throw new Error(`Vault file not found: ${source}`);
  }
  const text = await app.vault.read(file);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`File is not valid JSON: ${(e as Error).message}`);
  }
}

async function resolveManifestForImport(
  ctx: ImportAnnotationsContext,
  parsed: ParsedAnnotation[],
): Promise<IIIFManifest | null> {
  // Prefer the active note's frontmatter so the user stays in control.
  const fromNote = await resolveManifestFromActiveNote(ctx.app, ctx.settings);
  if (fromNote) return fromNote;
  const declared = parsed.map((p) => p.manifestId).find((id): id is string => !!id);
  if (!declared) return null;
  try {
    const raw = await fetchJson(declared);
    return parseManifest(raw, { preferredLanguages: ctx.settings.preferredLanguages });
  } catch {
    return null;
  }
}

function renderEmbed(a: ParsedAnnotation, manifest: IIIFManifest | null): string | null {
  if (!manifest) return null;
  const canvas = manifest.canvases.find((c) => c.id === a.canvasId);
  if (!canvas?.imageService?.id) return null;
  const apiV = manifest.version === "2" ? "2" : "3";
  const url = a.xywh
    ? buildImageUrl({
        service: canvas.imageService.id,
        region: { kind: "absolute", x: a.xywh.x, y: a.xywh.y, w: a.xywh.w, h: a.xywh.h },
        size: { kind: "max" },
        apiVersion: apiV,
      })
    : buildImageUrl({
        service: canvas.imageService.id,
        size: { kind: "max" },
        apiVersion: apiV,
      });
  const caption = (a.body || canvas.label).replace(/[\r\n]+/g, " ");
  return `![${caption}](${url})`;
}

function renderFallback(a: ParsedAnnotation): string {
  const lines: string[] = [];
  if (a.body) lines.push(`> ${a.body}`);
  lines.push(`> _Unmatched annotation — target_: \`${a.canvasId}\`` + (a.xywh ? ` \`xywh=${a.xywh.x},${a.xywh.y},${a.xywh.w},${a.xywh.h}\`` : ""));
  return lines.join("\n");
}

function formatError(e: unknown): string {
  if (e instanceof ManifestFetchError) return `Fetch failed: ${e.message}`;
  if (e instanceof IIIFParseError) return `Parse failed: ${e.message}`;
  if (e instanceof AnnotationParseError) return `Annotation parse failed: ${e.message}`;
  if (e instanceof Error) return e.message;
  return "Unknown error";
}
