/**
 * Minimal ALTO XML → plain text extractor.
 *
 * Pulls `CONTENT` attributes from `<String>` elements in document order,
 * inserting a newline between `<TextLine>`s and a blank line between
 * `<TextBlock>`s. Tolerates both attribute-quoting styles and common
 * variants (self-closing / paired tags, namespace prefixes).
 *
 * This is *not* a full XML parser — intentionally. ALTO's structure is
 * simple enough that regex extraction is reliable for every major
 * producer (LoC, BnF, e-codices, Transkribus) and avoids pulling a DOM
 * parser into the test runner.
 */

const TEXT_BLOCK = /<([a-z0-9:]*TextBlock)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
const TEXT_LINE = /<([a-z0-9:]*TextLine)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
const STRING_CONTENT = /<[a-z0-9:]*String\b[^>]*\bCONTENT\s*=\s*(["'])([\s\S]*?)\1[^>]*\/?>/gi;

export function altoToText(xml: string): string {
  const blocks: string[] = [];
  for (const block of iterate(xml, TEXT_BLOCK)) {
    const lines: string[] = [];
    for (const line of iterate(block, TEXT_LINE)) {
      const words: string[] = [];
      for (const m of line.matchAll(STRING_CONTENT)) {
        words.push(decodeXmlEntities(m[2] ?? ""));
      }
      if (words.length > 0) lines.push(words.join(" "));
    }
    if (lines.length > 0) blocks.push(lines.join("\n"));
  }

  if (blocks.length > 0) return blocks.join("\n\n").trim();

  // Fallback: no TextBlocks — flatten all <String CONTENT>s.
  const flat: string[] = [];
  for (const m of xml.matchAll(STRING_CONTENT)) {
    flat.push(decodeXmlEntities(m[2] ?? ""));
  }
  return flat.join(" ").trim();
}

function* iterate(source: string, pattern: RegExp): Generator<string> {
  const re = new RegExp(pattern.source, pattern.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    yield m[2] ?? "";
  }
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}
