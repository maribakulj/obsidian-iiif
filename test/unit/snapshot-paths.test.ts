import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeSnapshotPath,
  extensionFromUrl,
} from "../../src/core/snapshot/paths.ts";

describe("extensionFromUrl", () => {
  it("keeps .jpg / .png / .webp / .gif / .tif / .jp2", () => {
    assert.equal(extensionFromUrl("https://x/y/z.png"), ".png");
    assert.equal(extensionFromUrl("https://x/y/z.webp"), ".webp");
    assert.equal(extensionFromUrl("https://x/y/z.tif"), ".tif");
    assert.equal(extensionFromUrl("https://x/y/z.tiff"), ".tiff");
    assert.equal(extensionFromUrl("https://x/y/z.jp2"), ".jp2");
  });

  it("normalizes .jpeg to .jpg", () => {
    assert.equal(extensionFromUrl("https://x/y/z.JPEG"), ".jpg");
  });

  it("defaults to .jpg for Image API URLs", () => {
    assert.equal(
      extensionFromUrl("https://iiif.org/img/full/200,/0/default.jpg"),
      ".jpg",
    );
  });

  it("defaults to .jpg for URLs without a recognizable extension", () => {
    assert.equal(extensionFromUrl("https://x/y/z"), ".jpg");
    assert.equal(extensionFromUrl("not a url"), ".jpg");
  });
});

describe("computeSnapshotPath", () => {
  it("joins folder + stem + -thumb + extension", () => {
    const p = computeSnapshotPath({
      attachmentFolder: "IIIF/_attachments",
      noteStem: "Livre d'heures",
      remoteUrl: "https://example.org/thumb.png",
    });
    assert.equal(p.fullPath, "IIIF/_attachments/Livre d'heures-thumb.png");
  });

  it("sanitizes the note stem", () => {
    const p = computeSnapshotPath({
      attachmentFolder: "IIIF/_attachments",
      noteStem: "foo/bar:baz",
      remoteUrl: "https://x/y.jpg",
    });
    assert.equal(p.fullPath, "IIIF/_attachments/foobarbaz-thumb.jpg");
  });

  it("strips leading/trailing slashes from the folder", () => {
    const p = computeSnapshotPath({
      attachmentFolder: "/IIIF/attachments/",
      noteStem: "Book",
      remoteUrl: "https://x/y.jpg",
    });
    assert.equal(p.fullPath, "IIIF/attachments/Book-thumb.jpg");
  });

  it("produces a relative embed path when note is in the same folder", () => {
    const p = computeSnapshotPath({
      attachmentFolder: "IIIF",
      noteStem: "Book",
      remoteUrl: "https://x/y.jpg",
    });
    assert.equal(p.relativeFromNote("IIIF"), "Book-thumb.jpg");
  });

  it("produces a relative embed path when note is in a sibling folder", () => {
    const p = computeSnapshotPath({
      attachmentFolder: "IIIF/_attachments",
      noteStem: "Book",
      remoteUrl: "https://x/y.jpg",
    });
    assert.equal(p.relativeFromNote("IIIF"), "_attachments/Book-thumb.jpg");
  });

  it("uses ../ when note is above the attachment folder", () => {
    const p = computeSnapshotPath({
      attachmentFolder: "shared/_attachments",
      noteStem: "Book",
      remoteUrl: "https://x/y.jpg",
    });
    assert.equal(p.relativeFromNote("other/notes"), "../../shared/_attachments/Book-thumb.jpg");
  });

  it("falls back to 'iiif' when sanitized stem is empty", () => {
    const p = computeSnapshotPath({
      attachmentFolder: "X",
      noteStem: "///",
      remoteUrl: "https://x/y.jpg",
    });
    assert.equal(p.fullPath, "X/iiif-thumb.jpg");
  });
});
