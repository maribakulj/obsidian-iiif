import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { enrichFrontmatter } from "../../src/core/note/metadata-enrichment.ts";

describe("enrichFrontmatter", () => {
  it("maps French labels onto canonical keys", () => {
    const out = enrichFrontmatter([
      { label: "Lieu", value: "Paris" },
      { label: "Cote", value: "MS lat. 1173" },
      { label: "Auteur", value: "Anonyme" },
    ]);
    assert.deepEqual(out, {
      place: "Paris",
      shelfmark: "MS lat. 1173",
      creator: "Anonyme",
    });
  });

  it("maps English labels onto the same canonical keys", () => {
    const out = enrichFrontmatter([
      { label: "Place", value: "Paris" },
      { label: "Shelfmark", value: "MS X" },
      { label: "Creator", value: "Anon." },
    ]);
    assert.deepEqual(out, {
      place: "Paris",
      shelfmark: "MS X",
      creator: "Anon.",
    });
  });

  it("is diacritic-insensitive", () => {
    const out = enrichFrontmatter([
      { label: "Créateur", value: "X" },
      { label: "Période", value: "XIVe siècle" },
    ]);
    assert.equal(out.creator, "X");
    assert.equal(out.period, "XIVe siècle");
  });

  it("is case-insensitive", () => {
    const out = enrichFrontmatter([{ label: "DATE", value: "1500" }]);
    assert.equal(out.date, "1500");
  });

  it("first match wins when a manifest has overlapping labels", () => {
    const out = enrichFrontmatter([
      { label: "Author", value: "Primary" },
      { label: "Creator", value: "Secondary" },
    ]);
    assert.equal(out.creator, "Primary");
  });

  it("ignores labels that don't map to any canonical key", () => {
    const out = enrichFrontmatter([
      { label: "Completely unrelated", value: "nope" },
      { label: "Date", value: "1500" },
    ]);
    assert.deepEqual(out, { date: "1500" });
  });

  it("emits nothing for an empty metadata block", () => {
    assert.deepEqual(enrichFrontmatter([]), {});
  });
});
