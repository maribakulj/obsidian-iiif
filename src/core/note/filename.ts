import type { IIIFManifest } from "../iiif/types.ts";

/** Characters forbidden by Obsidian / common filesystems. */
const FORBIDDEN = /[\\/:*?"<>|#^[\]]+/g;

/**
 * Render a filename (without extension) from a template.
 *
 * Supported placeholders:
 *   - `{{label}}`    manifest label
 *   - `{{id}}`       last path segment of manifest URL
 *   - `{{version}}`  IIIF version (`2` or `3`)
 *
 * Result is sanitized and bounded to 200 chars; falls back to a generic
 * label when the template resolves to an empty string.
 */
export function buildFilename(template: string, manifest: IIIFManifest): string {
  const raw = template
    .replace(/\{\{\s*label\s*\}\}/g, manifest.label ?? "")
    .replace(/\{\{\s*id\s*\}\}/g, lastSegment(manifest.id))
    .replace(/\{\{\s*version\s*\}\}/g, manifest.version);
  return sanitize(raw) || "Untitled IIIF manifest";
}

export function sanitize(s: string): string {
  return s
    .replace(FORBIDDEN, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function lastSegment(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? u.host;
  } catch {
    return url;
  }
}

/**
 * Append a numeric suffix until `exists(name)` returns false.
 * Works on filenames *with* extension (`foo.md` → `foo 1.md`).
 */
export function uniquify(
  baseName: string,
  exists: (name: string) => boolean,
): string {
  if (!exists(baseName)) return baseName;
  const dot = baseName.lastIndexOf(".");
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
  const ext = dot > 0 ? baseName.slice(dot) : "";
  for (let i = 1; i < 1000; i++) {
    const candidate = `${stem} ${i}${ext}`;
    if (!exists(candidate)) return candidate;
  }
  throw new Error(`could not find a free filename for ${baseName}`);
}
