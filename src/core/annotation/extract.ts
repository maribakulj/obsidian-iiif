/**
 * Walk a Markdown note body for IIIF Image API embeds inserted by the
 * plugin and collect them in document order. Each entry pairs the
 * embed's caption (annotation body) with the parsed Image API URL
 * (annotation target).
 */

import {
  parseImageApiUrl,
  parseRegion,
  type ImageApiParts,
  type ParsedRegion,
} from "./image-api-parser.ts";

/** Markdown image-embed regex: `![caption](URL)`. Captures alt + url. */
const EMBED_RE = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;

export interface ExtractedEmbed {
  /** Markdown caption (alt text) — may be empty. */
  caption: string;
  /** Original URL straight from the note. */
  url: string;
  /** Decoded Image API parts. */
  parts: ImageApiParts;
  /** Decoded region (full/square/absolute/percent). */
  region: ParsedRegion;
}

export function extractIIIFEmbeds(noteBody: string): ExtractedEmbed[] {
  const out: ExtractedEmbed[] = [];
  for (const m of noteBody.matchAll(EMBED_RE)) {
    const caption = m[1] ?? "";
    const url = m[2] ?? "";
    const parts = parseImageApiUrl(url);
    if (!parts) continue;
    const region = parseRegion(parts.region);
    if (!region) continue;
    out.push({ caption, url, parts, region });
  }
  return out;
}

/**
 * Strip the YAML frontmatter from a note so the extractor only walks
 * the body. The frontmatter's `iiif_thumbnail` URL would otherwise
 * be (incorrectly) reported as an annotation target.
 */
export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---", 4);
  if (end < 0) return content;
  return content.slice(end + 4).replace(/^\n+/, "");
}
