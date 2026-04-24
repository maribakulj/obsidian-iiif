# Release checklist

Internal checklist for preparing a new release. Not user-facing.

## Pre-flight

- [ ] `npm test` — all green
- [ ] `npm run typecheck` — no errors
- [ ] `npm run build` — produces a clean `main.js` and `styles.css`
- [ ] `CHANGELOG.md` has an entry for the new version
- [ ] `manifest.json`, `package.json`, and `versions.json` all agree on
      the new version number
- [ ] Open a fresh vault, install the built files manually, and smoke-test
      the four core commands (Import, Insert region, Browse canvases,
      Refresh)

## Release

```bash
git tag v1.0.0
git push --tags
```

Create a GitHub Release for the tag. Attach:

- `manifest.json`
- `main.js`
- `styles.css`

**No source archives needed** — Obsidian downloads only these three
files when installing a plugin.

## Community-plugin listing (first release only)

1. Fork [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases).
2. Add an entry at the bottom of `community-plugins.json`:

   ```json
   {
     "id": "obsidian-iiif",
     "name": "IIIF Research Companion",
     "author": "maribakulj",
     "description": "Import IIIF manifests, clip image regions, ingest transcripts, and weave patrimonial digital objects into your notes.",
     "repo": "maribakulj/obsidian-iiif"
   }
   ```

3. Open a PR titled `Add IIIF Research Companion`.
4. Respond to any reviewer feedback. Typical checks:
   - Plugin ID matches folder name and `manifest.json`.
   - `main.js` is included in the release.
   - No bundled node_modules or other heavy artefacts.
   - No `console.log` debug statements shipped.
   - `isDesktopOnly` set correctly.

## Subsequent releases

For each new version, update `versions.json` to map the new plugin
version to the minimum Obsidian app version it supports, then tag +
create a Release. The community-plugin listing stays as-is; Obsidian
auto-detects new releases of already-listed plugins.
