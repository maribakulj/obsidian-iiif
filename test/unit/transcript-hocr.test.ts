import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hocrToText } from "../../src/core/transcripts/hocr.ts";

describe("hocrToText", () => {
  it("extracts text from ocr_line spans with newlines between lines", () => {
    const html = `
      <div class="ocr_page">
        <span class="ocr_line"><span class="ocrx_word">Hello</span> <span class="ocrx_word">world</span></span>
        <span class="ocr_line"><span class="ocrx_word">Second</span> <span class="ocrx_word">line</span></span>
      </div>`;
    const out = hocrToText(html);
    assert.equal(out.split("\n").length, 2);
    assert.match(out, /Hello world/);
    assert.match(out, /Second line/);
  });

  it("inserts blank line between paragraphs (ocr_par / <p>)", () => {
    const html = `
      <p class="ocr_par">
        <span class="ocr_line"><span class="ocrx_word">Para1</span></span>
      </p>
      <p class="ocr_par">
        <span class="ocr_line"><span class="ocrx_word">Para2</span></span>
      </p>`;
    const out = hocrToText(html);
    assert.match(out, /Para1\n+Para2/);
  });

  it("strips script and style blocks wholesale", () => {
    const html = `<style>body{color:red}</style><span class="ocr_line"><span class="ocrx_word">Foo</span></span><script>alert(1)</script>`;
    assert.equal(hocrToText(html), "Foo");
  });

  it("decodes HTML entities", () => {
    const html = `<span class="ocr_line">A &amp; B &nbsp; C</span>`;
    const out = hocrToText(html);
    assert.ok(out.includes("A & B"));
    assert.ok(out.includes("C"));
  });

  it("handles <br> as a line break", () => {
    const html = `<span class="ocr_line">first<br/>second</span>`;
    const out = hocrToText(html);
    assert.match(out, /first\n+second/);
  });

  it("returns empty string for input with no text", () => {
    assert.equal(hocrToText("<html><head></head><body></body></html>"), "");
  });
});
