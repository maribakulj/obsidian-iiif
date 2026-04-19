/**
 * Parse a Web Annotation document — `AnnotationPage`, bare
 * `Annotation`, or an array of either — into a flat list of imports
 * we can render as Markdown image embeds.
 *
 * Tolerates JSON-LD shape variations (`@id`/`id`, single-string
 * `motivation` or array, single-object `body` or array).
 */

export class AnnotationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnnotationParseError";
  }
}

export interface ParsedAnnotation {
  /** The annotation's id, when present. */
  id?: string;
  /** Caption text — first TextualBody value, or empty. */
  body: string;
  /** Canvas URI from `target.source` (or `target.id` when no selector). */
  canvasId: string;
  /** Manifest URI from `target.partOf` or document `partOf`. */
  manifestId?: string;
  /** Decoded `xywh=` value when present (`null` for canvas-scope annotations). */
  xywh: { x: number; y: number; w: number; h: number } | null;
  /** Original motivation, lowercased. */
  motivation?: string;
}

export function parseAnnotationDocument(raw: unknown): ParsedAnnotation[] {
  const documents = Array.isArray(raw) ? raw : [raw];
  const out: ParsedAnnotation[] = [];
  let any = false;
  for (const doc of documents) {
    if (!isObject(doc)) continue;
    any = true;
    const documentPartOf = readPartOf(doc);
    const items = collectAnnotations(doc);
    for (const a of items) {
      const parsed = parseSingle(a, documentPartOf);
      if (parsed) out.push(parsed);
    }
  }
  if (!any) throw new AnnotationParseError("Document is not a JSON object or array of objects.");
  return out;
}

function collectAnnotations(doc: Record<string, unknown>): Record<string, unknown>[] {
  const t = asString(doc["type"] ?? doc["@type"]);
  if (t === "Annotation") return [doc];
  if (t === "AnnotationPage" || t === "AnnotationCollection") {
    const items = doc["items"];
    if (Array.isArray(items)) return items.filter(isObject);
  }
  // Permissive fallback: a bare object with target+body looks like an Annotation.
  if (doc["target"] && doc["body"]) return [doc];
  return [];
}

function parseSingle(
  anno: Record<string, unknown>,
  fallbackPartOf: string | undefined,
): ParsedAnnotation | null {
  const id = asString(anno["id"] ?? anno["@id"]);
  const body = readBody(anno["body"]);
  const target = anno["target"];
  const targetParsed = readTarget(target);
  if (!targetParsed) return null;
  const motivation = readMotivation(anno["motivation"]);
  return {
    id,
    body,
    canvasId: targetParsed.canvasId,
    manifestId: targetParsed.manifestId ?? fallbackPartOf,
    xywh: targetParsed.xywh,
    motivation,
  };
}

function readTarget(raw: unknown): {
  canvasId: string;
  manifestId?: string;
  xywh: { x: number; y: number; w: number; h: number } | null;
} | null {
  if (typeof raw === "string") {
    const { id, xywh } = splitFragment(raw);
    return { canvasId: id, xywh };
  }
  if (!isObject(raw)) return null;
  const source = asString(raw["source"] ?? raw["id"] ?? raw["@id"]);
  if (!source) return null;
  let xywh: ReturnType<typeof readXywh> = null;
  const selector = raw["selector"];
  if (isObject(selector)) xywh = readXywh(asString(selector["value"]));
  if (!xywh && source.includes("#xywh=")) {
    const split = splitFragment(source);
    return {
      canvasId: split.id,
      manifestId: readPartOf(raw),
      xywh: split.xywh,
    };
  }
  return {
    canvasId: source,
    manifestId: readPartOf(raw),
    xywh,
  };
}

function splitFragment(uri: string): {
  id: string;
  xywh: { x: number; y: number; w: number; h: number } | null;
} {
  const idx = uri.indexOf("#xywh=");
  if (idx < 0) return { id: uri, xywh: null };
  return { id: uri.slice(0, idx), xywh: readXywh(uri.slice(idx + 1)) };
}

function readXywh(value: string | undefined): {
  x: number;
  y: number;
  w: number;
  h: number;
} | null {
  if (!value) return null;
  const m = value.match(/^xywh=(?:pixel:)?(\d+),(\d+),(\d+),(\d+)$/);
  if (!m) return null;
  return {
    x: parseInt(m[1]!, 10),
    y: parseInt(m[2]!, 10),
    w: parseInt(m[3]!, 10),
    h: parseInt(m[4]!, 10),
  };
}

function readBody(raw: unknown): string {
  const arr = Array.isArray(raw) ? raw : [raw];
  for (const b of arr) {
    if (typeof b === "string" && b.length > 0) return b;
    if (isObject(b)) {
      const v = asString(b["value"] ?? b["chars"]);
      if (v) return v;
    }
  }
  return "";
}

function readPartOf(raw: unknown): string | undefined {
  if (!isObject(raw)) return undefined;
  const partOf = raw["partOf"];
  if (typeof partOf === "string") return partOf;
  if (isObject(partOf)) return asString(partOf["id"] ?? partOf["@id"]);
  if (Array.isArray(partOf) && isObject(partOf[0])) {
    return asString(partOf[0]["id"] ?? partOf[0]["@id"]);
  }
  return undefined;
}

function readMotivation(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw.toLowerCase();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].toLowerCase();
  return undefined;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
