# IIIF manifest fixtures

Hand-crafted manifests based on canonical examples from the
[IIIF Presentation API specifications](https://iiif.io/api/presentation/)
and the [IIIF Cookbook](https://iiif.io/api/cookbook/).

The corpus is designed to exercise the parser (Sprint 1) against the full
shape of real-world manifests — both IIIF 2.1 and 3.0 — without requiring
network access during tests.

## Coverage matrix

| File | Version | Kind | Exercises |
| --- | --- | --- | --- |
| `v2-single-image.json` | 2.1 | Single-canvas | Minimal v2, `@id` / `@type`, string label |
| `v2-book.json` | 2.1 | Book / manuscript | `sequences` → `canvases`, `metadata` block, `attribution`, `thumbnail` |
| `v2-collection.json` | 2.1 | Collection | `@type: sc:Collection`, nested manifest refs |
| `v3-single-image.json` | 3.0 | Single-canvas | Minimal v3, `items` structure, language-map `label` |
| `v3-book.json` | 3.0 | Book / manuscript | `provider`, `requiredStatement`, `rights`, multilingual metadata |
| `v3-with-painting-anno.json` | 3.0 | Painting annotations | `AnnotationPage` → `Annotation` with `motivation: painting` |
| `v3-with-seealso.json` | 3.0 | Transcript-enabled | `seeAlso` to ALTO XML (Sprint 5 target) |
| `v3-collection.json` | 3.0 | Collection | v3 collection with `items` of type `Manifest` |
| `edge-no-label.json` | 3.0 | Malformed | Missing `label` — parser must fall back gracefully |
| `edge-mixed-languages.json` | 3.0 | Multilingual | Labels in `fr` / `en` / `la` / `none` |

## Policy

- When a bug is found against a real-world manifest in the wild, that
  manifest is added here *with* its provenance (URL + fetched-at date) and
  a regression test.
- Fixtures are kept minimal but faithful to spec shape — don't strip away
  fields that the parser should handle.
