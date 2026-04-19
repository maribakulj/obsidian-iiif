/**
 * Normalized internal IIIF model.
 *
 * Parser output always conforms to these types regardless of whether the
 * source manifest is IIIF Presentation API v2.1 or v3.0. The rest of the
 * plugin should never see raw manifest JSON.
 */

export type IIIFVersion = "2" | "3";

export interface IIIFMetadataPair {
  label: string;
  value: string;
}

export interface IIIFImageService {
  /** Base URL for the Image API (no trailing slash, no `/info.json`). */
  id: string;
  /** E.g. `ImageService2`, `ImageService3`; absent when not declared. */
  type?: string;
  /** Compliance level string (e.g. `level2`, or full URI in v2). */
  profile?: string;
}

export interface IIIFResource {
  id: string;
  label?: string;
  format?: string;
  profile?: string;
  type?: string;
}

export interface IIIFCanvas {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Preferred way to build Image API URLs. */
  imageService?: IIIFImageService;
  /** Fallback: a direct image URL when no service is declared. */
  imageUrl?: string;
  thumbnail?: string;
  seeAlso: IIIFResource[];
}

export interface IIIFManifest {
  id: string;
  version: IIIFVersion;
  label: string;
  summary?: string;
  metadata: IIIFMetadataPair[];
  thumbnail?: string;
  /** License/rights URI. */
  rights?: string;
  /** v3 `requiredStatement`, or v2 `attribution` mapped in. */
  requiredStatement?: IIIFMetadataPair;
  /** v3 provider label, if any. */
  provider?: string;
  canvases: IIIFCanvas[];
  rendering: IIIFResource[];
  seeAlso: IIIFResource[];
  /** Original manifest JSON for advanced consumers. Not serialized. */
  raw: unknown;
}

export interface IIIFCollectionEntry {
  id: string;
  type: "Manifest" | "Collection";
  label: string;
  thumbnail?: string;
}

export interface IIIFCollection {
  id: string;
  version: IIIFVersion;
  label: string;
  summary?: string;
  items: IIIFCollectionEntry[];
  raw: unknown;
}

export type IIIFTopLevel = IIIFManifest | IIIFCollection;
