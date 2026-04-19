import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickLabel } from "../../src/core/iiif/language.ts";

describe("pickLabel", () => {
  describe("primitive inputs", () => {
    it("returns undefined for null/undefined", () => {
      assert.equal(pickLabel(undefined), undefined);
      assert.equal(pickLabel(null), undefined);
    });

    it("returns the string unchanged (v2 plain string)", () => {
      assert.equal(pickLabel("Manuscrit 42"), "Manuscrit 42");
    });

    it("returns undefined for empty string", () => {
      assert.equal(pickLabel(""), undefined);
    });
  });

  describe("v2 arrays", () => {
    it("joins an array of strings", () => {
      assert.equal(pickLabel(["foo", "bar"]), "foo; bar");
    });

    it("honours joiner option", () => {
      assert.equal(pickLabel(["foo", "bar"], { joiner: " / " }), "foo / bar");
    });

    it("picks localized @value matching preferred", () => {
      const v = [
        { "@value": "Book", "@language": "en" },
        { "@value": "Livre", "@language": "fr" },
      ];
      assert.equal(pickLabel(v, { preferred: ["fr"] }), "Livre");
      assert.equal(pickLabel(v, { preferred: ["en"] }), "Book");
    });

    it("falls back to unlanguaged values before anything else", () => {
      const v = [
        { "@value": "untagged" },
        { "@value": "Foo", "@language": "en" },
      ];
      assert.equal(pickLabel(v, { preferred: ["de"] }), "untagged");
    });

    it("handles a single localized object (not wrapped in array)", () => {
      assert.equal(pickLabel({ "@value": "Solo", "@language": "fr" } as never), "Solo");
    });
  });

  describe("v3 language maps", () => {
    it("picks preferred language first", () => {
      const v = { fr: ["Livre"], en: ["Book"] };
      assert.equal(pickLabel(v, { preferred: ["fr"] }), "Livre");
    });

    it("tries preferences in order", () => {
      const v = { en: ["Book"], la: ["Liber"] };
      assert.equal(pickLabel(v, { preferred: ["fr", "en", "la"] }), "Book");
    });

    it("falls back to `none` when no preferred match", () => {
      const v = { en: ["Book"], none: ["Cote XYZ"] };
      assert.equal(pickLabel(v, { preferred: ["fr"] }), "Cote XYZ");
    });

    it("falls back to `en` when no preferred and no `none`", () => {
      const v = { en: ["Book"], de: ["Buch"] };
      assert.equal(pickLabel(v, { preferred: ["fr"] }), "Book");
    });

    it("falls back to first available otherwise", () => {
      const v = { la: ["Liber"], de: ["Buch"] };
      assert.ok(["Liber", "Buch"].includes(pickLabel(v, { preferred: ["fr"] })!));
    });

    it("joins multi-entry arrays", () => {
      assert.equal(pickLabel({ en: ["A", "B"] }, { preferred: ["en"] }), "A; B");
    });

    it("skips empty arrays", () => {
      const v = { fr: [], en: ["Book"] };
      assert.equal(pickLabel(v, { preferred: ["fr", "en"] }), "Book");
    });
  });
});
