import { buildThumbnailUrl } from "../iiif/image-api.ts";
import type { IIIFManifest } from "../iiif/types.ts";
import { serializeFrontmatter, type Frontmatter } from "./frontmatter.ts";
import { enrichFrontmatter } from "./metadata-enrichment.ts";

export interface NoteBuilderOptions {
  /** Original manifest URL — preserved in frontmatter for re-fetch. */
  manifestUrl: string;
  /** Timestamp for the `imported` frontmatter field. */
  importedAt: Date;
  /** Width (px) for the embedded header thumbnail. */
  thumbnailWidth: number;
  /** Render a canvas table in the body. */
  insertCanvasTable: boolean;
  /** Cap the number of rows in the canvas table. */
  maxCanvasesInTable: number;
}

export interface BuiltNote {
  filenameStem: string; // caller appends `.md`
  body: string;
}

export function buildManifestNote(
  manifest: IIIFManifest,
  opts: NoteBuilderOptions,
): string {
  return [
    "---",
    serializeFrontmatter(buildFrontmatter(manifest, opts)).trimEnd(),
    "---",
    "",
    buildBody(manifest, opts),
  ].join("\n");
}

function buildFrontmatter(manifest: IIIFManifest, opts: NoteBuilderOptions): Frontmatter {
  const fm: Frontmatter = {
    iiif_manifest: opts.manifestUrl,
    iiif_version: manifest.version,
    title: manifest.label,
    canvas_count: manifest.canvases.length,
    imported: opts.importedAt.toISOString().slice(0, 10),
    tags: ["iiif"],
  };
  if (manifest.provider) fm.provider = manifest.provider;
  if (manifest.rights) fm.rights = manifest.rights;
  for (const [key, value] of Object.entries(enrichFrontmatter(manifest.metadata))) {
    if (!(key in fm)) fm[key] = value;
  }
  return fm;
}

function buildBody(manifest: IIIFManifest, opts: NoteBuilderOptions): string {
  const sections: string[] = [];
  sections.push(`# ${manifest.label}`);

  const subtitleBits = [manifest.provider, manifest.rights].filter(Boolean) as string[];
  if (subtitleBits.length > 0) {
    sections.push(`> ${subtitleBits.join(" · ")}`);
  }

  const headerThumb = pickHeaderThumbnail(manifest, opts.thumbnailWidth);
  if (headerThumb) {
    sections.push(`![](${headerThumb})`);
  }

  if (manifest.summary) {
    sections.push("## Description", manifest.summary);
  }

  if (manifest.requiredStatement) {
    sections.push(
      "## Attribution",
      `**${manifest.requiredStatement.label}** — ${manifest.requiredStatement.value}`,
    );
  }

  if (manifest.metadata.length > 0) {
    sections.push("## Métadonnées", renderMetadataTable(manifest.metadata));
  }

  if (opts.insertCanvasTable && manifest.canvases.length > 0) {
    sections.push(
      `## Canvases (${manifest.canvases.length})`,
      renderCanvasTable(manifest, opts.maxCanvasesInTable),
    );
  }

  const resources = renderResources(manifest);
  if (resources) sections.push("## Ressources", resources);

  return sections.join("\n\n") + "\n";
}

function pickHeaderThumbnail(manifest: IIIFManifest, width: number): string | undefined {
  if (manifest.thumbnail) return manifest.thumbnail;
  const firstCanvasService = manifest.canvases[0]?.imageService?.id;
  if (firstCanvasService) {
    return buildThumbnailUrl(
      firstCanvasService,
      width,
      manifest.version === "2" ? "2" : "3",
    );
  }
  return undefined;
}

function renderMetadataTable(metadata: { label: string; value: string }[]): string {
  const rows = metadata
    .map((p) => `| ${escapeTableCell(p.label)} | ${escapeTableCell(p.value)} |`)
    .join("\n");
  return `| | |\n| --- | --- |\n${rows}`;
}

function renderCanvasTable(manifest: IIIFManifest, max: number): string {
  const apiV = manifest.version === "2" ? "2" : "3";
  const rows = manifest.canvases.slice(0, max).map((c, i) => {
    const dim = c.width && c.height ? `${c.width}×${c.height}` : "—";
    const thumb = c.imageService?.id
      ? `[link](${buildThumbnailUrl(c.imageService.id, 120, apiV)})`
      : c.thumbnail
        ? `[link](${c.thumbnail})`
        : "—";
    return `| ${i + 1} | ${escapeTableCell(c.label)} | ${dim} | ${thumb} |`;
  });
  const truncated = manifest.canvases.length > max;
  const truncationNote = truncated
    ? `\n\n_… ${manifest.canvases.length - max} more canvases not shown (raise \`maxCanvasesInTable\` in settings)._`
    : "";
  return [
    "| # | Label | Dimensions | Thumbnail |",
    "| ---: | --- | --- | --- |",
    rows.join("\n"),
  ].join("\n") + truncationNote;
}

function renderResources(manifest: IIIFManifest): string | undefined {
  const items: string[] = [];
  for (const r of manifest.rendering) {
    items.push(`- 📄 [${r.label ?? r.format ?? "Download"}](${r.id})${r.format ? ` _(${r.format})_` : ""}`);
  }
  for (const r of manifest.seeAlso) {
    items.push(`- 🔗 [${r.label ?? r.format ?? "See also"}](${r.id})${r.format ? ` _(${r.format})_` : ""}`);
  }
  return items.length > 0 ? items.join("\n") : undefined;
}

function escapeTableCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
