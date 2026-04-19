import type { IIIFMetadataPair } from "../iiif/types.ts";

/**
 * Map multi-lingual metadata labels onto a small set of canonical
 * frontmatter keys so Dataview queries work across manifests without
 * knowing whether a library used `Date` / `Datation` / `Dated`, etc.
 *
 * Canonical keys on the left; every accepted label (normalized) on
 * the right. First matching pair wins — later duplicates are ignored.
 */
const ALIASES: Array<[canonical: string, labels: readonly string[]]> = [
  ["date", ["date", "dated", "datation"]],
  ["place", ["place", "lieu", "origin", "origine", "location"]],
  [
    "shelfmark",
    ["shelfmark", "cote", "callnumber", "call number", "pressmark", "signature"],
  ],
  [
    "creator",
    [
      "creator",
      "author",
      "auteur",
      "créateur",
      "createur",
      "artist",
      "artiste",
      "scribe",
    ],
  ],
  ["subject", ["subject", "sujet", "topic", "theme", "thème"]],
  ["language", ["language", "langue"]],
  ["material", ["material", "support", "materials", "medium", "matériaux", "materiaux"]],
  ["extent", ["extent", "dimensions", "taille", "size"]],
  ["period", ["period", "période", "periode", "century", "siècle", "siecle", "era"]],
  ["repository", ["repository", "holding institution", "holding", "institution"]],
  ["title", ["title", "titre"]],
];

/**
 * Extract canonical frontmatter entries from a manifest's metadata
 * block. Preserves first-match semantics and returns a plain object
 * suitable for merging into the note's frontmatter.
 */
export function enrichFrontmatter(
  metadata: IIIFMetadataPair[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [canonical, labels] of ALIASES) {
    const found = findFirst(metadata, labels);
    if (found && !(canonical in out)) out[canonical] = found.value;
  }
  return out;
}

function findFirst(
  metadata: IIIFMetadataPair[],
  labels: readonly string[],
): IIIFMetadataPair | undefined {
  const set = new Set(labels.map(normalize));
  return metadata.find((p) => set.has(normalize(p.label)));
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
