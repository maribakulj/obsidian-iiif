import { sanitize } from "../note/filename.ts";

/**
 * Pure helpers for computing where an in-vault thumbnail snapshot lives.
 *
 * The layout is:
 *   <attachmentFolder>/<noteStem>-thumb.<ext>
 *
 * so that one note owns exactly one attachment, filenames stay
 * predictable, and stale attachments are easy to spot alongside the
 * notes that own them.
 */

export interface SnapshotPathInput {
  /** Folder (relative to vault root) where attachments are stored. */
  attachmentFolder: string;
  /** Filename stem of the owning note (e.g. "Livre d'heures"). */
  noteStem: string;
  /** Remote thumbnail URL — used only to pick an extension. */
  remoteUrl: string;
}

export interface SnapshotPath {
  /** Full vault-relative path, e.g. `IIIF/_attachments/Livre-thumb.jpg`. */
  fullPath: string;
  /** Path relative to the note's parent folder — used in the Markdown embed. */
  relativeFromNote: (noteFolder: string) => string;
}

export function computeSnapshotPath(input: SnapshotPathInput): SnapshotPath {
  const folder = normalizeFolder(input.attachmentFolder);
  const ext = extensionFromUrl(input.remoteUrl);
  const stem = sanitize(input.noteStem) || "iiif";
  const fullPath = `${folder}/${stem}-thumb${ext}`.replace(/^\/+/, "");
  return {
    fullPath,
    relativeFromNote: (noteFolder: string) => relativize(fullPath, normalizeFolder(noteFolder)),
  };
}

/**
 * Pick a file extension from a URL, mapped to a stable image type.
 * Defaults to `.jpg` when the URL looks like an Image API URL (which
 * ends in `/default.jpg`) or when nothing useful can be inferred.
 */
export function extensionFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
    const dot = last.lastIndexOf(".");
    if (dot > 0) {
      const ext = last.slice(dot).toLowerCase();
      if (/^\.(jpe?g|png|webp|gif|tiff?|jp2)$/.test(ext)) return ext === ".jpeg" ? ".jpg" : ext;
    }
  } catch {
    /* ignore */
  }
  return ".jpg";
}

function normalizeFolder(p: string): string {
  return p.replace(/^\/+|\/+$/g, "").replace(/\\/g, "/");
}

/**
 * Turn an absolute vault-relative path into a relative reference
 * suitable for a Markdown embed inside a note at `noteFolder`.
 */
function relativize(fullPath: string, noteFolder: string): string {
  if (noteFolder === "") return fullPath;
  const full = fullPath.split("/");
  const base = noteFolder.split("/");
  let i = 0;
  while (i < full.length && i < base.length && full[i] === base[i]) i++;
  const up = base.length - i;
  const down = full.slice(i);
  return [...Array(up).fill(".."), ...down].join("/");
}
