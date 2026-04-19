import type { LanguagePickOptions } from "../core/iiif/language.ts";

export interface IIIFSettings {
  /** Folder under the vault root where imported notes are created. */
  folder: string;
  /** Filename template; supports {{label}}, {{id}}, {{version}}. */
  filenameTemplate: string;
  /** Ordered BCP-47 tags used to resolve language maps. */
  preferredLanguages: string[];
  /** Open the freshly created note after import. */
  openAfterImport: boolean;
  /** Width (px) used for the embedded thumbnail in note bodies. */
  thumbnailWidth: number;
  /** Render a canvas table in the note body. */
  insertCanvasTable: boolean;
  /** Cap on rows in the canvas table to keep notes readable. */
  maxCanvasesInTable: number;
  /** Width (px) the region picker requests when rendering a canvas. */
  regionPickerDisplayWidth: number;
  /** Width (px) baked into the inserted Image API URL for a region. */
  regionInsertWidth: number;
  /** Truncate inserted transcripts beyond this many characters. 0 = unlimited. */
  transcriptMaxChars: number;
}

export const DEFAULT_SETTINGS: IIIFSettings = {
  folder: "IIIF",
  filenameTemplate: "{{label}}",
  preferredLanguages: ["en"],
  openAfterImport: true,
  thumbnailWidth: 400,
  insertCanvasTable: true,
  maxCanvasesInTable: 50,
  regionPickerDisplayWidth: 1024,
  regionInsertWidth: 800,
  transcriptMaxChars: 20000,
};

export function toLangOpts(s: IIIFSettings): LanguagePickOptions {
  return { preferred: s.preferredLanguages };
}
