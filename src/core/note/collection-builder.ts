import type { IIIFCollection, IIIFCollectionEntry } from "../iiif/types.ts";
import { serializeFrontmatter, type Frontmatter } from "./frontmatter.ts";

export interface CollectionImportReport {
  entry: IIIFCollectionEntry;
  /** `imported` = note created; `failed` = error; `skipped` = sub-collection. */
  status: "imported" | "failed" | "skipped";
  /** Basename of the created note, for wiki-linking. */
  noteStem?: string;
  /** Present when `status === 'failed'`. */
  errorMessage?: string;
}

export interface BuildIndexNoteOptions {
  collectionUrl: string;
  importedAt: Date;
  reports: CollectionImportReport[];
}

/**
 * Assemble the index note that sits at the top of a collection folder.
 * The index holds a frontmatter block for Dataview queries and a
 * table enumerating every item — imported successfully, failed, or
 * skipped as a sub-collection.
 */
export function buildCollectionIndexNote(
  collection: IIIFCollection,
  opts: BuildIndexNoteOptions,
): string {
  const imported = opts.reports.filter((r) => r.status === "imported").length;
  const failed = opts.reports.filter((r) => r.status === "failed").length;
  const skipped = opts.reports.filter((r) => r.status === "skipped").length;

  const fm: Frontmatter = {
    iiif_collection: opts.collectionUrl,
    iiif_version: collection.version,
    title: collection.label,
    item_count: collection.items.length,
    imported: opts.importedAt.toISOString().slice(0, 10),
    imported_ok: imported,
    imported_failed: failed,
    sub_collections: skipped,
    tags: ["iiif", "iiif-collection"],
  };

  const sections: string[] = [];
  sections.push(`# ${collection.label}`);

  const stats: string[] = [];
  stats.push(`${collection.items.length} item${collection.items.length === 1 ? "" : "s"}`);
  if (imported > 0) stats.push(`${imported} imported`);
  if (failed > 0) stats.push(`${failed} failed`);
  if (skipped > 0) stats.push(`${skipped} sub-collection${skipped === 1 ? "" : "s"}`);
  sections.push(`> ${stats.join(" · ")}`);

  if (collection.summary) {
    sections.push("## Description", collection.summary);
  }

  const manifestReports = opts.reports.filter((r) => r.entry.type === "Manifest");
  const subCollectionReports = opts.reports.filter((r) => r.entry.type === "Collection");

  if (manifestReports.length > 0) {
    sections.push("## Manifests", renderManifestTable(manifestReports));
  }

  if (subCollectionReports.length > 0) {
    sections.push(
      "## Sub-collections",
      "_Not imported automatically — re-run the import command on each URL to expand._\n\n" +
        subCollectionReports
          .map((r) => `- [${escapeInlineCell(r.entry.label)}](${r.entry.id})`)
          .join("\n"),
    );
  }

  return [
    "---",
    serializeFrontmatter(fm).trimEnd(),
    "---",
    "",
    sections.join("\n\n") + "\n",
  ].join("\n");
}

function renderManifestTable(reports: CollectionImportReport[]): string {
  const rows = reports.map((r, i) => {
    const label = escapeInlineCell(r.entry.label);
    const note = r.status === "imported" && r.noteStem
      ? `[[${r.noteStem}]]`
      : "—";
    const status = renderStatus(r);
    return `| ${i + 1} | ${label} | ${note} | ${status} |`;
  });
  return [
    "| # | Label | Note | Status |",
    "| ---: | --- | --- | --- |",
    rows.join("\n"),
  ].join("\n");
}

function renderStatus(r: CollectionImportReport): string {
  switch (r.status) {
    case "imported":
      return "✅ imported";
    case "skipped":
      return "⤵️ sub-collection";
    case "failed":
      return `❌ ${escapeInlineCell(r.errorMessage ?? "failed")}`;
  }
}

function escapeInlineCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
