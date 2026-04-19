import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildViewerUrl,
  ViewerConfigError,
} from "../../src/core/viewer/url-builder.ts";

const MANIFEST = "https://example.org/iiif/3/abc/manifest.json";

describe("buildViewerUrl", () => {
  it("Mirador preset URL-encodes the manifest param", () => {
    const { url, preset } = buildViewerUrl({ kind: "mirador", manifestUrl: MANIFEST });
    assert.equal(preset.kind, "mirador");
    assert.equal(
      url,
      `https://projectmirador.org/embed/?manifest=${encodeURIComponent(MANIFEST)}`,
    );
  });

  it("Universal Viewer preset keeps the hash route", () => {
    const { url } = buildViewerUrl({ kind: "universal", manifestUrl: MANIFEST });
    assert.match(url, /^https:\/\/uv-v4\.netlify\.app\/#\?manifest=/);
    assert.ok(url.includes(encodeURIComponent(MANIFEST)));
  });

  it("replaces every occurrence of {url} in a custom template", () => {
    const { url } = buildViewerUrl({
      kind: "custom",
      customTemplate: "https://a/?m={url}&back={url}",
      manifestUrl: MANIFEST,
    });
    const enc = encodeURIComponent(MANIFEST);
    assert.equal(url, `https://a/?m=${enc}&back=${enc}`);
  });

  it("throws ViewerConfigError when custom is selected but template is empty", () => {
    assert.throws(
      () => buildViewerUrl({ kind: "custom", manifestUrl: MANIFEST }),
      ViewerConfigError,
    );
    assert.throws(
      () => buildViewerUrl({ kind: "custom", customTemplate: "   ", manifestUrl: MANIFEST }),
      ViewerConfigError,
    );
  });

  it("throws when custom template lacks the {url} placeholder", () => {
    assert.throws(
      () =>
        buildViewerUrl({
          kind: "custom",
          customTemplate: "https://a/b",
          manifestUrl: MANIFEST,
        }),
      ViewerConfigError,
    );
  });

  it("percent-encodes reserved chars correctly", () => {
    const weird = "https://ex/iiif/with spaces?foo=bar&baz=qux/manifest.json";
    const { url } = buildViewerUrl({ kind: "mirador", manifestUrl: weird });
    // Spaces → %20, ? → %3F, & → %26, = → %3D
    assert.ok(url.includes("%20"));
    assert.ok(url.includes("%3F"));
    assert.ok(url.includes("%26"));
    assert.ok(url.includes("%3D"));
  });
});
