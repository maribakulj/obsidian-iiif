# Contributing to IIIF Research Companion

Thanks for your interest. This plugin stays deliberately small and
focused, so contributions tend to be:

1. **Bug fixes** backed by a regression test.
2. **Parser improvements** driven by a real-world manifest that breaks.
3. **New metadata alias** for a language the enrichment table doesn't
   cover yet.
4. **Documentation** improvements.

Please **open an issue before opening a large PR** — it's usually quick
to align on scope before you write code.

## Dev setup

Requires Node 22+ (the test runner uses native TypeScript loading via
`--experimental-strip-types`).

```bash
git clone https://github.com/maribakulj/obsidian-iiif
cd obsidian-iiif
npm install
npm run dev   # watch + rebuild into ./main.js
```

Symlink the repo into a test vault's plugins folder:

```bash
ln -s "$(pwd)" /path/to/test-vault/.obsidian/plugins/obsidian-iiif
```

Then enable the plugin in Obsidian's community plugins settings.
Hit Ctrl/Cmd-R in the developer console to reload after changes.

## Useful scripts

```bash
npm run typecheck   # tsc --noEmit
npm test            # 260+ unit tests against fixture manifests
npm run build       # production build (tsc + esbuild --minify)
```

## Architecture quickstart

```
src/
├── core/
│   ├── iiif/          # parser, Image API builder, diff, region math
│   ├── note/          # manifest → Markdown, filename/frontmatter helpers
│   ├── transcripts/   # ALTO / hOCR / plain-text extraction
│   ├── annotation/    # W3C Web Annotation round-trip
│   ├── snapshot/      # in-vault thumbnail caching
│   ├── viewer/        # Mirador / UV URL templates
│   ├── http/          # Obsidian requestUrl wrapper
│   └── util/          # map-limit
├── commands/          # glue: reads frontmatter / opens modals / calls core
├── ui/                # Modal classes only — no business logic
├── settings/          # SettingsTab + types + defaults
└── main.ts            # Plugin entry point, command registration
```

**Design rules:**
- `core/` is Obsidian-free (except `http/fetcher.ts` and
  `snapshot/thumbnail.ts` which wrap Obsidian's binary-safe HTTP and
  vault APIs). Everything else is portable and tested in Node.
- `commands/` is the glue that wires Obsidian to core. Each command
  is a single `run*` function receiving `{ app, settings }`.
- `ui/` classes render modals — they don't touch the vault or the
  network directly, they call back into commands or `core/`.

## Testing policy

- Every pure module in `core/` has a unit test file under
  `test/unit/<name>.test.ts`.
- Parser tests run against the hand-crafted fixture corpus in
  `test/fixtures/manifests/` — both IIIF 2.1 and 3.0 shapes.
- When a real-world manifest produces a bug, **add it to the fixture
  corpus alongside a regression test**.
- Modal classes aren't unit-tested (they need a DOM + Obsidian).
  Keep them thin — delegate to pure helpers that *are* tested.

## Adding a metadata alias

If your institution uses a label the enrichment table doesn't know
about, edit `src/core/note/metadata-enrichment.ts` and add an alias
to the appropriate canonical key. Add a test in
`test/unit/metadata-enrichment.test.ts`. That's usually a 5-line PR.

## Adding a fixture manifest

1. Drop the JSON (trimmed to the interesting bits) into
   `test/fixtures/manifests/<descriptive-name>.json`.
2. Add a row to the coverage matrix in
   `test/fixtures/README.md`.
3. Add the relevant assertions in `test/unit/parser.test.ts`.

## Release process

1. All tests pass (`npm test`) and the build is clean (`npm run build`).
2. Bump `version` in `manifest.json`, `package.json`, and add an entry
   in `versions.json` mapping the new version to its `minAppVersion`.
3. Update `CHANGELOG.md`.
4. Tag the commit (`git tag v1.0.0 && git push --tags`).
5. Create a GitHub Release with `manifest.json`, `main.js`, and
   `styles.css` attached.
6. For community-plugin listing: submit a PR to
   [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases)
   adding an entry to `community-plugins.json`.

## Out of scope — please don't send PRs for

These constraints exist to keep the plugin honest about its role
(see README). Exceptions require a prior issue + alignment:

- A full IIIF viewer inside Obsidian (use Mirador / UV externally).
- IIIF Authentication API (authenticated manifests).
- Round-trip annotation with institutional Web Annotation servers
  (we export/import JSON-LD files; that's as far as it goes).
- Full Content Search API integration (use `seeAlso` transcripts).
- Manifest authoring / editing.
