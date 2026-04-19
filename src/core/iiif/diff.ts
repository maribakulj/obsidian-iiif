import { enrichFrontmatter } from "../note/metadata-enrichment.ts";
import type { IIIFManifest } from "./types.ts";

export interface ScalarChange {
  field: string;
  from: string | undefined;
  to: string | undefined;
}

export interface ManifestDiff {
  /** True when no meaningful change was detected. */
  unchanged: boolean;
  /** Scalar fields (label, version, provider, rights, count) that differ. */
  scalarChanges: ScalarChange[];
  /** Canvas IDs present in `to` but not in `from`. */
  addedCanvases: Array<{ id: string; label: string }>;
  /** Canvas IDs present in `from` but not in `to`. */
  removedCanvases: Array<{ id: string; label: string }>;
  /** Canvases kept but with a changed label. */
  relabeledCanvases: Array<{ id: string; from: string; to: string }>;
  /** Canonical (Dataview) frontmatter fields that changed. */
  metadataChanges: ScalarChange[];
}

/**
 * Compare two parsed manifests and summarize what's meaningfully
 * different. Designed for the refresh command — it surfaces what a
 * user would need to audit, not every internal change.
 */
export function diffManifests(from: IIIFManifest, to: IIIFManifest): ManifestDiff {
  const scalarChanges = collectScalarChanges(from, to);
  const { added, removed, relabeled } = diffCanvases(from, to);
  const metadataChanges = diffEnrichedMetadata(from, to);

  const unchanged =
    scalarChanges.length === 0 &&
    added.length === 0 &&
    removed.length === 0 &&
    relabeled.length === 0 &&
    metadataChanges.length === 0;

  return {
    unchanged,
    scalarChanges,
    addedCanvases: added,
    removedCanvases: removed,
    relabeledCanvases: relabeled,
    metadataChanges,
  };
}

function collectScalarChanges(from: IIIFManifest, to: IIIFManifest): ScalarChange[] {
  const changes: ScalarChange[] = [];
  const check = (field: string, a: string | undefined, b: string | undefined): void => {
    const na = a ?? undefined;
    const nb = b ?? undefined;
    if (na !== nb) changes.push({ field, from: na, to: nb });
  };
  check("label", from.label, to.label);
  check("version", from.version, to.version);
  check("provider", from.provider, to.provider);
  check("rights", from.rights, to.rights);
  check(
    "canvas_count",
    String(from.canvases.length),
    String(to.canvases.length),
  );
  return changes;
}

function diffCanvases(from: IIIFManifest, to: IIIFManifest): {
  added: Array<{ id: string; label: string }>;
  removed: Array<{ id: string; label: string }>;
  relabeled: Array<{ id: string; from: string; to: string }>;
} {
  const fromMap = new Map(from.canvases.map((c) => [c.id, c]));
  const toMap = new Map(to.canvases.map((c) => [c.id, c]));
  const added: Array<{ id: string; label: string }> = [];
  const removed: Array<{ id: string; label: string }> = [];
  const relabeled: Array<{ id: string; from: string; to: string }> = [];
  for (const [id, c] of toMap) {
    const prev = fromMap.get(id);
    if (!prev) added.push({ id, label: c.label });
    else if (prev.label !== c.label) relabeled.push({ id, from: prev.label, to: c.label });
  }
  for (const [id, c] of fromMap) {
    if (!toMap.has(id)) removed.push({ id, label: c.label });
  }
  return { added, removed, relabeled };
}

function diffEnrichedMetadata(from: IIIFManifest, to: IIIFManifest): ScalarChange[] {
  const fromFm = enrichFrontmatter(from.metadata);
  const toFm = enrichFrontmatter(to.metadata);
  const keys = new Set([...Object.keys(fromFm), ...Object.keys(toFm)]);
  const changes: ScalarChange[] = [];
  for (const key of keys) {
    if (fromFm[key] !== toFm[key]) {
      changes.push({ field: key, from: fromFm[key], to: toFm[key] });
    }
  }
  return changes;
}
