# IIIF Research Companion for Obsidian

Import IIIF manifests, clip image regions, and weave patrimonial digital objects
into your notes.

> **Status** — v0.4 (Sprint 7). Import, region picker, canvas browser,
> transcript ingestion (ALTO / hOCR / plain text), snapshot + refresh,
> and bulk collection import are all live.

## Concept

Obsidian is excellent for *linking* and *indexing*, not for rendering large
image viewers. This plugin does **not** try to replace Mirador or Universal
Viewer. Instead, it makes IIIF objects first-class citizens in your vault:

- **Import a manifest URL** → structured note with metadata, thumbnail,
  canvas table, and Dataview-compatible frontmatter.
- **Clip a region** → drag a rectangle on a canvas, insert the exact
  IIIF Image API URL as a Markdown image embed.
- **Hand off to Mirador / UV** → deep links via the Content State API for
  full consultation when needed.

Think *Zotero for patrimonial visual objects*, not *Mirador in Obsidian*.

## Roadmap

| Sprint | Focus | Release |
| --- | --- | --- |
| 0 | Bootstrap, CI, fixture corpus | ✅ |
| 1 | IIIF v2/v3 parser, Image API builder | ✅ |
| 2 | Manifest import command | ✅ v0.1 |
| 3 | Region picker (drag-rectangle) | ✅ v0.2 |
| 4 | Canvas browser | ✅ |
| 5 | Transcripts & metadata enrichment | ✅ v0.3 |
| 6 | Cache & resilience | ✅ v0.3.1 |
| 7 | Collections support | ✅ v0.4 |
| 8 | External viewer handoff (Mirador/UV) | — |
| 9 | W3C Web Annotation export | v0.5 |
| 10 | Polish & community submission | v1.0 |

## Development

### Prerequisites

- Node.js 20+
- A local Obsidian vault for testing

### Setup

```bash
npm install
npm run dev         # watch + rebuild to ./main.js
```

### Hot-reload into a vault

Symlink the repo directory into your test vault's plugins folder:

```bash
ln -s "$(pwd)" /path/to/vault/.obsidian/plugins/obsidian-iiif
```

Then enable the plugin in Obsidian's community plugins settings. With
`npm run dev` running, reloading Obsidian (Ctrl/Cmd-R in developer console)
picks up changes.

### Useful commands

```bash
npm run build       # type-check + production build
npm run typecheck   # tsc --noEmit
npm test            # run test suite against fixture manifests
```

## Using the plugin (v0.2)

### Import a manifest

1. Open the command palette and run **IIIF: Import IIIF manifest from URL**.
2. Paste the URL of a IIIF Presentation API v2 or v3 manifest.
3. Click **Fetch & preview** to validate and see a summary.
4. Click **Import** — a new note is created in your configured folder
   (default: `IIIF/`) with frontmatter, embedded thumbnail, metadata
   table, and a canvas listing.

### Insert a cropped region

1. In any note, run **IIIF: Insert IIIF region** from the command palette.
2. If the active note has an `iiif_manifest` frontmatter field, the picker
   reuses it silently; otherwise paste a manifest URL.
3. Pick a canvas from the thumbnail grid.
4. Drag a rectangle over the rendered canvas to select a region.
5. Preview, add an optional caption, and click **Insert** — a Markdown
   image embed pointing at the exact IIIF Image API region is inserted
   at your cursor.

### Browse and insert whole canvases

1. Run **IIIF: Browse IIIF canvases and insert** from the command palette.
2. Filter by label (e.g. `f. 127`) and paginate through long manuscripts.
3. Click tiles to toggle selection — multi-select is supported.
4. Click **Insert** to drop all picked canvases into the note at once,
   in manifest order, as separate Markdown image embeds.

### Insert a transcript (ALTO / hOCR / plain text)

1. Run **IIIF: Insert IIIF transcript** from the command palette.
2. The modal lists every transcript declared in the manifest's
   `seeAlso` (manifest-level and per-canvas) with its format and
   scope.
3. Click **Insert** on the one you want — the transcript is downloaded,
   converted to plain text, and inserted as a Markdown section at your
   cursor. Long transcripts are truncated per settings.

Frontmatter is Dataview-friendly. Imported notes expose canonicalized
keys (`date`, `place`, `shelfmark`, `creator`, `period`, `material`,
`repository`, etc.) so you can query across manifests regardless of
whether a library used French, English, or Latin metadata labels.

### Keep notes visually intact over time

Enable **Snapshot header thumbnail to vault** in settings. At import
time, the plugin downloads the manifest's header thumbnail and saves
it as a vault attachment. The note embeds that local copy instead of
the remote URL, so your notes keep their visual identity even if the
institution reorganizes its URLs later. The remote URL is preserved
in frontmatter for future refreshes.

### Import an entire corpus (IIIF Collection)

1. Run **IIIF: Import IIIF collection from URL** from the command palette.
2. Paste a IIIF Collection URL. The modal shows a preview (label,
   summary, item count).
3. Click **Import** — every `Manifest` entry is fetched and imported
   concurrently (3 at a time) into a dedicated subfolder. An index
   note at the folder root links to each imported note and records
   failures so they're easy to spot.
4. Each imported note carries `parent_collection` (URL) and
   `collection_index` (wiki-link back to the index) in frontmatter
   for Dataview navigation across the whole corpus.

Sub-collections are listed in the index as external links. Re-run
the command on each to expand them.

### Refresh a manifest

Over time, institutions update metadata, add canvases, or fix labels.
Open an imported note and run **IIIF: Refresh manifest from frontmatter**.
The plugin re-fetches the manifest, shows you a diff (changed fields,
added / removed / relabeled canvases, canonical metadata deltas), and
on confirmation updates the frontmatter in place. The note body is
**never** mutated — you decide what to do about structural changes,
keeping your annotations safe.

### Fixture corpus

`test/fixtures/manifests/` contains real IIIF manifests from major
institutions, used for parser tests. Each is checked in with a short
provenance note in `test/fixtures/README.md`. Both IIIF Presentation API
v2 and v3 are represented.

When a bug is found against a wild manifest, the offending manifest is
added to the corpus alongside a regression test.

## Out of scope

Explicit non-goals, to keep scope honest:

- Full IIIF viewer integrated in Obsidian (use Mirador/UV externally).
- IIIF Authentication API (authenticated manifests).
- Round-trip annotation with institutional Web Annotation servers.
- Full Content Search API integration.
- Manifest authoring/editing.

## License

MIT — see [LICENSE](./LICENSE).
