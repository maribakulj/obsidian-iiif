/**
 * Minimal hOCR → plain text extractor.
 *
 * hOCR is HTML with semantic classes (`ocr_line`, `ocr_par`, `ocrx_word`).
 * We preserve the document order and insert newlines between `ocr_line`
 * elements and blank lines between `ocr_par` elements, then strip tags.
 * Regex-based for the same reason as ALTO — portable, zero-dep,
 * testable in Node without a DOM shim.
 */

export function hocrToText(html: string): string {
  // 1. Drop scripts and styles wholesale.
  let work = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "");

  // 2. Insert structural separators between hOCR blocks.
  work = work
    .replace(/<\/p\b[^>]*>/gi, "</p>\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /(<\/span\s*>)\s*(?=<span\b[^>]*class="[^"]*\bocr_line\b[^"]*")/gi,
      "$1\n",
    );

  // 3. Strip remaining tags.
  const stripped = work.replace(/<[^>]+>/g, "");

  // 4. Decode entities + collapse whitespace while preserving line breaks.
  return decodeHtmlEntities(stripped)
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
}

function decodeHtmlEntities(s: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: "\u00a0",
  };
  return s
    .replace(/&([a-z]+);/gi, (m, name) => named[name.toLowerCase()] ?? m)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}
