# Changelog

All notable changes to **IIIF Research Companion** are documented here.
The format loosely follows [Keep a Changelog](https://keepachangelog.com/)
and the project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] — Sprint 10 — polish & community release

### Changed
- Unified note-body section headers to English (`Metadata`, `Resources`)
  so notes render consistently regardless of the user's UI language.
- Dropped a small amount of dead code (`BuiltNote` interface).

### Added
- `CHANGELOG.md` (this file).
- `CONTRIBUTING.md` with dev setup, testing policy, and architecture
  overview.
- Expanded README with an installation section, features matrix, and
  troubleshooting guide.

## [0.5.0] — Sprint 9 — W3C Web Annotation round-trip

### Added
- **Export note as Web Annotations.** Walks the active note for IIIF
  region/canvas embeds and writes a `<note>.annotations.json`
  `AnnotationPage` next to the note. Each annotation targets the
  matching canvas with a `xywh=` Media Fragments selector.
- **Import Web Annotations.** Accepts a vault path or URL pointing at
  a W3C `AnnotationPage` / `Annotation` document and inserts every
  annotation as a Markdown image embed at the cursor.
- Tolerant JSON-LD reader — handles `AnnotationPage`, bare
  `Annotation`, and arrays; `@id`/`id` and `@type`/`type` variants;
  targets as URIs with `#xywh=` or as `SpecificResource` + selector.

## [0.4.1] — Sprint 8 — external viewer handoff

### Added
- **Open manifest in external viewer** command. Deep-links to Mirador
  or Universal Viewer with the active note's manifest URL.
- **Copy external viewer link** command for clipboard hand-off.
- Settings: viewer dropdown (Mirador / Universal Viewer / Custom URL
  template) and custom template with `{url}` placeholder for
  self-hosted viewers.

## [0.4.0] — Sprint 7 — IIIF Collection bulk import

### Added
- **Import IIIF collection from URL** command. Fetches a collection,
  imports every `Manifest` entry concurrently into a dedicated
  subfolder, and creates an index note listing every item.
- `parent_collection` and `collection_index` frontmatter fields on
  imported manifest notes for Dataview corpus queries.
- `core/util/map-limit.ts`: concurrency-limited async map helper
  (defaults to 3 concurrent fetches).

## [0.3.1] — Sprint 6 — snapshot + refresh

### Added
- **Snapshot header thumbnail to vault** (opt-in): downloads the
  header thumbnail at import time and saves it as a vault
  attachment. Notes keep their visual identity even if the
  institution reorganizes its URLs later.
- **Refresh manifest from frontmatter** command. Re-fetches the
  manifest, computes a structured diff, and updates the frontmatter
  in place. The note body is never mutated — annotations stay safe.
- `iiif_thumbnail` and `iiif_thumbnail_local` frontmatter fields.

## [0.3.0] — Sprint 5 — transcripts + metadata enrichment

### Added
- **Insert IIIF transcript** command. Detects ALTO / hOCR / plain
  text transcripts in a manifest's `seeAlso` and inserts the
  converted text as a Markdown section.
- Metadata enrichment: multi-lingual labels (Lieu / Place, Cote /
  Shelfmark, Créateur / Author, …) canonicalized into a small set
  of frontmatter keys (`date`, `place`, `shelfmark`, `creator`, …)
  for Dataview corpus queries.
- `transcriptMaxChars` setting (default 20k).

## [0.2.0] — Sprint 3 — region picker

### Added
- **Insert IIIF region** command. Four-phase modal (source → canvas
  → region → preview) with a drag-rectangle canvas picker; the
  resulting Markdown embed points at the exact IIIF Image API URL
  for the cropped region.
- Pointer-capture dragging for clean tracking beyond the canvas.
- Settings: region picker display width + inserted region width.

## [0.1.0] — Sprint 2 — manifest import MVP

### Added
- **Import IIIF manifest from URL** command. Two-step modal (fetch +
  preview, then import) creates a Markdown note with Dataview-
  friendly frontmatter, embedded header thumbnail, metadata table,
  canvas table, and `Resources` section.
- Settings tab with import folder, filename template, preferred
  languages, thumbnail width, canvas table cap.

## [Sprint 1] — internal foundation

### Added
- Parser for IIIF Presentation API v2.1 and v3.0 with a single
  normalized internal model.
- Language-map resolver with a preference cascade (preferred →
  none → en → first).
- Image API URL builder with validation (rejects out-of-range
  coords, enforces integers, v2 vs v3 upscale handling).

## [Sprint 0] — bootstrap

### Added
- Plugin scaffold (TypeScript + esbuild), GitHub Actions CI, and a
  hand-crafted corpus of 10 fixture manifests (IIIF v2 + v3,
  books, collections, edge cases) used as test fixtures.
