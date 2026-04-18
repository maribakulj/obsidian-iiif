/**
 * IIIF Presentation API parser — accepts v2.1 or v3.0 manifests and
 * collections and normalizes them into a single internal model
 * (see `./types.ts`).
 *
 * Design: the rest of the plugin should never see raw IIIF JSON. All
 * shape- and version-specific handling is concentrated here.
 */

import { pickLabel, type LanguagePickOptions } from "./language.ts";
import type {
  IIIFCanvas,
  IIIFCollection,
  IIIFCollectionEntry,
  IIIFImageService,
  IIIFManifest,
  IIIFMetadataPair,
  IIIFResource,
  IIIFTopLevel,
  IIIFVersion,
} from "./types.ts";

export interface ParseOptions {
  /** Ordered BCP-47 tags preferred when resolving language maps. */
  preferredLanguages?: string[];
}

export class IIIFParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IIIFParseError";
  }
}

// ---------- Entry points ----------

export function detectVersion(raw: unknown): IIIFVersion | null {
  if (!isObject(raw)) return null;

  const ctx = raw["@context"];
  const ctxs = asArray<string>(typeof ctx === "string" || Array.isArray(ctx) ? ctx : undefined);
  for (const c of ctxs) {
    if (typeof c !== "string") continue;
    if (c.includes("/presentation/3/")) return "3";
    if (c.includes("/presentation/2/")) return "2";
  }

  // Fallback: v3 uses `id`/`type`, v2 uses `@id`/`@type`.
  if (typeof raw["type"] === "string" && typeof raw["id"] === "string") return "3";
  if (typeof raw["@type"] === "string" && typeof raw["@id"] === "string") return "2";

  return null;
}

export function detectKind(raw: unknown): "Manifest" | "Collection" | null {
  if (!isObject(raw)) return null;
  const t = (raw["type"] ?? raw["@type"]) as string | string[] | undefined;
  const types = asArray<string>(t);
  for (const ty of types) {
    if (ty === "Manifest" || ty === "sc:Manifest") return "Manifest";
    if (ty === "Collection" || ty === "sc:Collection") return "Collection";
  }
  return null;
}

export function parseIIIF(raw: unknown, opts: ParseOptions = {}): IIIFTopLevel {
  const kind = detectKind(raw);
  if (kind === "Manifest") return parseManifest(raw, opts);
  if (kind === "Collection") return parseCollection(raw, opts);
  throw new IIIFParseError(
    `Unrecognized IIIF resource: expected Manifest or Collection, got ${JSON.stringify(
      isObject(raw) ? (raw["type"] ?? raw["@type"]) : typeof raw,
    )}`,
  );
}

export function parseManifest(raw: unknown, opts: ParseOptions = {}): IIIFManifest {
  if (!isObject(raw)) throw new IIIFParseError("manifest is not an object");
  const version = detectVersion(raw);
  if (version == null) throw new IIIFParseError("cannot detect IIIF version (no @context)");

  const id = requireString(raw, ["id", "@id"], "manifest.id");
  const langOpts: LanguagePickOptions = { preferred: opts.preferredLanguages };

  const label = pickLabel(raw["label"] as never, langOpts) ?? fallbackLabelFromId(id);
  const summary = version === "3" ? pickLabel(raw["summary"] as never, langOpts) : pickLabel(raw["description"] as never, langOpts);

  const metadata = parseMetadata(raw["metadata"], langOpts);
  const thumbnail = parseThumbnail(raw["thumbnail"], langOpts);
  const rights = parseRights(raw, version);
  const requiredStatement = parseRequiredStatement(raw, version, langOpts);
  const provider = version === "3" ? parseProvider(raw["provider"], langOpts) : undefined;
  const canvases = parseCanvases(raw, version, langOpts);
  const rendering = parseResources(raw["rendering"], langOpts);
  const seeAlso = parseResources(raw["seeAlso"], langOpts);

  return {
    id,
    version,
    label,
    summary,
    metadata,
    thumbnail,
    rights,
    requiredStatement,
    provider,
    canvases,
    rendering,
    seeAlso,
    raw,
  };
}

export function parseCollection(raw: unknown, opts: ParseOptions = {}): IIIFCollection {
  if (!isObject(raw)) throw new IIIFParseError("collection is not an object");
  const version = detectVersion(raw);
  if (version == null) throw new IIIFParseError("cannot detect IIIF version (no @context)");

  const id = requireString(raw, ["id", "@id"], "collection.id");
  const langOpts: LanguagePickOptions = { preferred: opts.preferredLanguages };
  const label = pickLabel(raw["label"] as never, langOpts) ?? fallbackLabelFromId(id);
  const summary = version === "3"
    ? pickLabel(raw["summary"] as never, langOpts)
    : pickLabel(raw["description"] as never, langOpts);

  const items = version === "3"
    ? parseV3CollectionItems(raw["items"], langOpts)
    : parseV2CollectionItems(raw, langOpts);

  return { id, version, label, summary, items, raw };
}

// ---------- Metadata / labels ----------

function parseMetadata(raw: unknown, opts: LanguagePickOptions): IIIFMetadataPair[] {
  if (!Array.isArray(raw)) return [];
  const out: IIIFMetadataPair[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const label = pickLabel(entry["label"] as never, opts);
    const value = pickLabel(entry["value"] as never, opts);
    if (label && value) out.push({ label, value });
  }
  return out;
}

function parseThumbnail(raw: unknown, opts: LanguagePickOptions): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    for (const t of raw) {
      const s = parseThumbnail(t, opts);
      if (s) return s;
    }
    return undefined;
  }
  if (isObject(raw)) {
    const id = (raw["id"] ?? raw["@id"]) as string | undefined;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

function parseRights(raw: Record<string, unknown>, version: IIIFVersion): string | undefined {
  if (version === "3") {
    const r = raw["rights"];
    return typeof r === "string" ? r : undefined;
  }
  const l = raw["license"];
  if (typeof l === "string") return l;
  if (Array.isArray(l) && typeof l[0] === "string") return l[0];
  return undefined;
}

function parseRequiredStatement(
  raw: Record<string, unknown>,
  version: IIIFVersion,
  opts: LanguagePickOptions,
): IIIFMetadataPair | undefined {
  if (version === "3") {
    const rs = raw["requiredStatement"];
    if (!isObject(rs)) return undefined;
    const label = pickLabel(rs["label"] as never, opts);
    const value = pickLabel(rs["value"] as never, opts);
    return label && value ? { label, value } : undefined;
  }
  // v2: attribution maps onto requiredStatement for display parity.
  const attribution = pickLabel(raw["attribution"] as never, opts);
  return attribution ? { label: "Attribution", value: attribution } : undefined;
}

function parseProvider(raw: unknown, opts: LanguagePickOptions): string | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const first = raw[0];
  if (!isObject(first)) return undefined;
  return pickLabel(first["label"] as never, opts);
}

// ---------- Canvases ----------

function parseCanvases(
  raw: Record<string, unknown>,
  version: IIIFVersion,
  opts: LanguagePickOptions,
): IIIFCanvas[] {
  if (version === "3") return parseV3Canvases(raw["items"], opts);
  return parseV2Canvases(raw["sequences"], opts);
}

function parseV3Canvases(raw: unknown, opts: LanguagePickOptions): IIIFCanvas[] {
  if (!Array.isArray(raw)) return [];
  const out: IIIFCanvas[] = [];
  for (const c of raw) {
    if (!isObject(c)) continue;
    const id = asString(c["id"] ?? c["@id"]);
    if (!id) continue;
    const label = pickLabel(c["label"] as never, opts) ?? fallbackLabelFromId(id);
    const width = asInt(c["width"]) ?? 0;
    const height = asInt(c["height"]) ?? 0;

    const paintingPages = asArray<unknown>(c["items"]);
    const { service, imageUrl } = extractV3Image(paintingPages);

    out.push({
      id,
      label,
      width,
      height,
      imageService: service,
      imageUrl,
      thumbnail: parseThumbnail(c["thumbnail"], opts),
      seeAlso: parseResources(c["seeAlso"], opts),
    });
  }
  return out;
}

function extractV3Image(annotationPages: unknown[]): {
  service?: IIIFImageService;
  imageUrl?: string;
} {
  for (const page of annotationPages) {
    if (!isObject(page)) continue;
    const annos = asArray<unknown>(page["items"]);
    for (const anno of annos) {
      if (!isObject(anno)) continue;
      if (anno["motivation"] !== "painting") continue;
      const body = anno["body"];
      if (!isObject(body)) continue;
      const service = extractImageService(body["service"]);
      const imageUrl = asString(body["id"] ?? body["@id"]);
      if (service || imageUrl) return { service, imageUrl };
    }
  }
  return {};
}

function parseV2Canvases(raw: unknown, opts: LanguagePickOptions): IIIFCanvas[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: IIIFCanvas[] = [];
  for (const seq of raw) {
    if (!isObject(seq)) continue;
    const canvases = asArray<unknown>(seq["canvases"]);
    for (const c of canvases) {
      if (!isObject(c)) continue;
      const id = asString(c["@id"] ?? c["id"]);
      if (!id) continue;
      const label = pickLabel(c["label"] as never, opts) ?? fallbackLabelFromId(id);
      const width = asInt(c["width"]) ?? 0;
      const height = asInt(c["height"]) ?? 0;

      const images = asArray<unknown>(c["images"]);
      const { service, imageUrl } = extractV2Image(images);

      out.push({
        id,
        label,
        width,
        height,
        imageService: service,
        imageUrl,
        thumbnail: parseThumbnail(c["thumbnail"], opts),
        seeAlso: parseResources(c["seeAlso"], opts),
      });
    }
  }
  return out;
}

function extractV2Image(images: unknown[]): {
  service?: IIIFImageService;
  imageUrl?: string;
} {
  for (const img of images) {
    if (!isObject(img)) continue;
    const resource = img["resource"];
    if (!isObject(resource)) continue;
    const service = extractImageService(resource["service"]);
    const imageUrl = asString(resource["@id"] ?? resource["id"]);
    if (service || imageUrl) return { service, imageUrl };
  }
  return {};
}

function extractImageService(raw: unknown): IIIFImageService | undefined {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!isObject(first)) return undefined;
  const id = asString(first["id"] ?? first["@id"]);
  if (!id) return undefined;
  const type = asString(first["type"] ?? first["@type"]);
  const profile = asString(first["profile"]);
  return { id: id.replace(/\/+$/, ""), type, profile };
}

// ---------- Collections ----------

function parseV3CollectionItems(raw: unknown, opts: LanguagePickOptions): IIIFCollectionEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: IIIFCollectionEntry[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    const id = asString(item["id"]);
    const type = asString(item["type"]);
    if (!id || (type !== "Manifest" && type !== "Collection")) continue;
    out.push({
      id,
      type,
      label: pickLabel(item["label"] as never, opts) ?? fallbackLabelFromId(id),
      thumbnail: parseThumbnail(item["thumbnail"], opts),
    });
  }
  return out;
}

function parseV2CollectionItems(
  raw: Record<string, unknown>,
  opts: LanguagePickOptions,
): IIIFCollectionEntry[] {
  const out: IIIFCollectionEntry[] = [];
  for (const manifest of asArray<unknown>(raw["manifests"])) {
    if (!isObject(manifest)) continue;
    const id = asString(manifest["@id"] ?? manifest["id"]);
    if (!id) continue;
    out.push({
      id,
      type: "Manifest",
      label: pickLabel(manifest["label"] as never, opts) ?? fallbackLabelFromId(id),
      thumbnail: parseThumbnail(manifest["thumbnail"], opts),
    });
  }
  for (const sub of asArray<unknown>(raw["collections"])) {
    if (!isObject(sub)) continue;
    const id = asString(sub["@id"] ?? sub["id"]);
    if (!id) continue;
    out.push({
      id,
      type: "Collection",
      label: pickLabel(sub["label"] as never, opts) ?? fallbackLabelFromId(id),
      thumbnail: parseThumbnail(sub["thumbnail"], opts),
    });
  }
  return out;
}

// ---------- Resources (seeAlso, rendering) ----------

function parseResources(raw: unknown, opts: LanguagePickOptions): IIIFResource[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const out: IIIFResource[] = [];
  for (const r of arr) {
    if (typeof r === "string") {
      out.push({ id: r });
      continue;
    }
    if (!isObject(r)) continue;
    const id = asString(r["id"] ?? r["@id"]);
    if (!id) continue;
    out.push({
      id,
      label: pickLabel(r["label"] as never, opts),
      format: asString(r["format"]),
      profile: asString(r["profile"]),
      type: asString(r["type"] ?? r["@type"]),
    });
  }
  return out;
}

// ---------- Tiny helpers ----------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray<T>(v: unknown): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? (v as T[]) : [v as T];
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asInt(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function requireString(obj: Record<string, unknown>, keys: string[], field: string): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  throw new IIIFParseError(`missing required string field: ${field}`);
}

function fallbackLabelFromId(id: string): string {
  try {
    const u = new URL(id);
    return `[${u.host}${u.pathname}]`;
  } catch {
    return id;
  }
}
