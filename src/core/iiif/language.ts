/**
 * Resolve IIIF label/summary/metadata values to a single display string.
 *
 * Handles every shape the Presentation API allows:
 *
 *   v2: "string"
 *       ["string", "string"]
 *       { "@value": "string", "@language": "fr" }
 *       [{ "@value": "…" }, { "@value": "…" }]
 *
 *   v3: { "en": ["string"], "fr": ["string"] }        (language map)
 *       { "none": ["string"] }                        (unspecified language)
 *
 * The v3 language-selection algorithm (spec §4.1) is applied first; if
 * nothing matches, we fall through a cascade of reasonable fallbacks.
 */

export type LanguageMap = Record<string, string[]>;

export interface LanguagePickOptions {
  /** Ordered BCP-47 tags to try (e.g. `['fr', 'en']`). */
  preferred?: string[];
  /** Separator used when joining multiple strings for the same language. */
  joiner?: string;
}

interface V2LocalizedValue {
  "@value": string;
  "@language"?: string;
}

type RawValue =
  | string
  | string[]
  | V2LocalizedValue
  | V2LocalizedValue[]
  | LanguageMap
  | null
  | undefined;

const DEFAULT_JOINER = "; ";

export function pickLabel(value: RawValue, opts: LanguagePickOptions = {}): string | undefined {
  const joiner = opts.joiner ?? DEFAULT_JOINER;
  const preferred = opts.preferred ?? [];

  if (value == null) return undefined;

  if (typeof value === "string") {
    return value.length > 0 ? value : undefined;
  }

  if (Array.isArray(value)) {
    return pickFromArray(value, preferred, joiner);
  }

  if (typeof value === "object") {
    if (isV2Localized(value)) {
      return value["@value"];
    }
    return pickFromLanguageMap(value as LanguageMap, preferred, joiner);
  }

  return undefined;
}

function pickFromArray(
  arr: Array<string | V2LocalizedValue>,
  preferred: string[],
  joiner: string,
): string | undefined {
  if (arr.length === 0) return undefined;

  if (typeof arr[0] === "string") {
    const strings = arr.filter((x): x is string => typeof x === "string");
    return strings.length > 0 ? strings.join(joiner) : undefined;
  }

  const localized = arr.filter(isV2Localized);
  if (localized.length === 0) return undefined;

  for (const lang of preferred) {
    const match = localized.filter((v) => v["@language"] === lang);
    if (match.length > 0) return match.map((v) => v["@value"]).join(joiner);
  }
  const unspecified = localized.filter((v) => !v["@language"]);
  if (unspecified.length > 0) return unspecified.map((v) => v["@value"]).join(joiner);
  return localized.map((v) => v["@value"]).join(joiner);
}

function pickFromLanguageMap(
  map: LanguageMap,
  preferred: string[],
  joiner: string,
): string | undefined {
  for (const lang of preferred) {
    const v = map[lang];
    if (v && v.length > 0) return v.join(joiner);
  }
  if (map.none && map.none.length > 0) return map.none.join(joiner);
  if (map.en && map.en.length > 0) return map.en.join(joiner);
  for (const key of Object.keys(map)) {
    const v = map[key];
    if (v && v.length > 0) return v.join(joiner);
  }
  return undefined;
}

function isV2Localized(value: unknown): value is V2LocalizedValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "@value" in value &&
    typeof (value as Record<string, unknown>)["@value"] === "string"
  );
}
