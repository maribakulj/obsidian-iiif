# IIIF Research Companion for Obsidian

Import IIIF manifests, clip image regions, ingest transcripts, and weave
patrimonial digital objects into your vault — an Obsidian-native bridge
to the IIIF ecosystem.

> **Status** — v1.0. Stable, tested (260+ unit tests), and ready for
> scholarly use.

## Why?

Obsidian is excellent for *linking* and *indexing*, not for rendering
tiled image viewers. This plugin does **not** try to replace Mirador or
Universal Viewer. Instead, it makes IIIF objects first-class citizens
in your vault — think *Zotero for patrimonial visual objects*, not
*Mirador in Obsidian*.

If you're a historian, manuscript scholar, art historian, archivist, or
digital humanist and you take notes on IIIF-hosted objects, this plugin
is for you.

## Features

- 📥 **Import a manifest URL** → structured note with Dataview-friendly
  frontmatter, embedded thumbnail, metadata table, and canvas listing.
- 🧭 **Import a IIIF collection** → one note per manifest plus a linked
  index for the whole corpus, all in parallel.
- ✂️ **Clip a region** → drag-rectangle picker renders a canvas via the
  Image API; on release you get a Markdown embed pointing at the exact
  cropped region.
- 🖼️ **Browse canvases** → paginated, searchable thumbnail grid with
  multi-select for batch inserts (useful on 400-folio manuscripts).
- 📜 **Ingest transcripts** → detects ALTO XML, hOCR, and plain-text
  `seeAlso` resources and inserts a clean-text section.
- 💾 **Snapshot thumbnails to the vault** (opt-in) so notes keep their
  visual identity even if the institution reorganizes its URLs.
- 🔄 **Refresh manifests** with a structured diff against the stored
  frontmatter — the note body is never mutated.
- 🚀 **Hand off to Mirador / UV** when you need the full viewer
  experience; custom URL templates work for self-hosted instances.
- 🔁 **W3C Web Annotations round-trip** — export embeds as an
  interoperable `AnnotationPage`, import Web Annotation documents back
  as Markdown embeds.
- 🏷️ **Canonicalized metadata** — multi-lingual labels (Lieu / Place,
  Cote / Shelfmark, Créateur / Author, …) mapped onto a small set of
  frontmatter keys for Dataview corpus queries.

## Install

### From the Obsidian community plugins browser (recommended)

> Once the plugin is accepted in the registry (submission in progress):

1. In Obsidian: **Settings → Community plugins → Browse**.
2. Search for **IIIF Research Companion**.
3. Install and enable.

### From a GitHub release

1. Download `manifest.json`, `main.js`, and `styles.css` from the
   [latest release](https://github.com/maribakulj/obsidian-iiif/releases/latest).
2. Copy them into
   `<your-vault>/.obsidian/plugins/obsidian-iiif/`
   (create the folder if needed).
3. Restart Obsidian and enable the plugin under
   **Settings → Community plugins**.

### Via BRAT (for pre-release testing)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from the
   community plugins registry.
2. In BRAT's settings, add `maribakulj/obsidian-iiif` as a beta plugin.

## Quickstart

Open the command palette (Ctrl/Cmd-P) and run **IIIF: Import IIIF
manifest from URL**. Paste any public IIIF Presentation API v2 or v3
manifest URL — for example a Gallica (BnF), Bodleian, Library of
Congress, e-codices, or Wellcome Collection manifest. Within seconds
you'll have a richly structured note in your vault.

Then, in any note with an `iiif_manifest` frontmatter field, run
**IIIF: Insert IIIF region** and drag to crop a detail.

## Commands

| Command | Context | What it does |
| --- | --- | --- |
| `Import IIIF manifest from URL` | any | Fetch → preview → create note |
| `Import IIIF collection from URL` | any | Fetch → bulk-import manifests into a subfolder with an index note |
| `Insert IIIF region` | editor | Drag-rectangle picker → insert `![caption](cropped URL)` at cursor |
| `Browse IIIF canvases and insert` | editor | Paginated thumbnail grid with multi-select |
| `Insert IIIF transcript (ALTO / hOCR / plain text)` | editor | Pick a transcript declared in `seeAlso`, convert, insert |
| `Refresh manifest from frontmatter` | note with `iiif_manifest` | Re-fetch, diff, update frontmatter only |
| `Open manifest in external viewer` | note with `iiif_manifest` | Deep-link to Mirador / UV in browser |
| `Copy external viewer link` | note with `iiif_manifest` | Same URL to clipboard |
| `Export note's IIIF embeds as Web Annotations` | note with `iiif_manifest` | Write `<note>.annotations.json` |
| `Import Web Annotations into note` | editor | Read a JSON-LD document, insert embeds |

All commands live under the `IIIF:` prefix in the palette. Bind hotkeys
to your favourites via **Settings → Hotkeys**.

## Settings

| Section | Setting | Default | Purpose |
| --- | --- | --- | --- |
| Import | Import folder | `IIIF` | Where new notes are created |
| Import | Filename template | `{{label}}` | Supports `{{label}}`, `{{id}}`, `{{version}}` |
| Import | Preferred languages | `en` | Comma-separated BCP-47 tags, in order |
| Import | Open note after import | on | |
| Import | Header thumbnail width | `400` | Pixel width of the embedded header image |
| Import | Render canvas table | on | |
| Import | Max canvases in table | `50` | |
| External viewer | Viewer | Mirador | Mirador / Universal Viewer / Custom |
| External viewer | Custom URL template | — | For self-hosted instances, must contain `{url}` |
| Snapshots | Snapshot header thumbnail | off | Save as in-vault attachment at import time |
| Snapshots | Snapshot attachment folder | `IIIF/_attachments` | |
| Transcripts | Transcript truncation (chars) | `20000` | 0 = unlimited |
| Region picker | Display width | `1024` | Pixels requested when rendering a canvas for picking |
| Region picker | Inserted region width | `800` | Pixels baked into the embed URL |

## Frontmatter conventions

Imported manifest notes expose a stable set of frontmatter fields:

```yaml
iiif_manifest: https://example.org/iiif/ms-42/manifest
iiif_version: "3"
iiif_thumbnail: https://.../full/400,/0/default.jpg
iiif_thumbnail_local: Livre d'heures-thumb.jpg      # when snapshot is on
title: Livre d'heures à l'usage de Paris
canvas_count: 142
imported: 2026-04-19
provider: Bibliothèque d'Exemple
rights: https://creativecommons.org/licenses/by/4.0/
date: circa 1450
place: Paris
shelfmark: MS lat. 1173
creator: Anonyme
period: XVe siècle
material: Parchemin
tags: [iiif]
```

Collection index notes additionally carry `iiif_collection`,
`item_count`, `imported_ok`, and `imported_failed`.

Manifest notes imported as part of a collection carry
`parent_collection` (URL) and `collection_index` (`[[wiki-link]]` to
the index note).

## Dataview recipes

With [Dataview](https://github.com/blacksmithgu/obsidian-dataview)
installed, you can query your IIIF corpus like a database:

```dataview
TABLE provider, date, canvas_count
FROM #iiif
WHERE place = "Paris"
SORT date ASC
```

```dataview
LIST
FROM #iiif-collection
SORT imported_ok DESC
```

```dataview
TABLE file.link AS Manuscript, shelfmark, canvas_count
FROM #iiif
WHERE period AND contains(period, "XIV")
```

## Troubleshooting

**"Fetch failed" when importing a manifest.**
Obsidian bypasses CORS via its internal `requestUrl`, so CORS isn't
the issue. Check the URL loads in your browser. If it's an
authenticated manifest (IIIF Auth API), the plugin doesn't support
that — use a public variant or ask the provider.

**"Not a valid IIIF manifest" on a real URL.**
The response might not be a IIIF Presentation API resource (Presentation
v1 is not supported). If it's v2 or v3 and still fails, open an issue
with a link to the manifest — we'll add it to the fixture corpus.

**Region embed renders nothing in the note.**
The remote Image API server might be down, or its URL layout changed.
Open the IIIF URL in a browser tab to check. Consider enabling
**Snapshot header thumbnail to vault** for future imports.

**Imported note has no thumbnail.**
The manifest may not declare a top-level `thumbnail` and the first
canvas may not expose an `ImageService`. Nothing we can do — that's
the manifest.

**Collection import takes forever.**
Large collections fetch with a concurrency of 3 to be gentle on
institutional servers. For a 100-manifest collection, allow ~30 s
to 2 min depending on the host.

## Out of scope

Explicit non-goals, to keep scope honest:

- Full IIIF viewer inside Obsidian (use Mirador / UV externally).
- IIIF Authentication API (authenticated manifests).
- Federated annotation sync with institutional Web Annotation servers
  (we support local file-based JSON-LD round-trip, not server push).
- Full Content Search API integration (use `seeAlso` transcripts).
- Manifest authoring / editing.

## Development & contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for dev setup, architecture
overview, and the testing policy.

Quick start:

```bash
npm install
npm run dev      # watch + rebuild
npm test         # 260+ tests
npm run build    # production build (type-check + minify)
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

MIT — see [LICENSE](./LICENSE).
