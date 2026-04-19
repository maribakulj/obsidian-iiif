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
  /**
   * When enabled, the manifest importer downloads the header thumbnail
   * and stores it as a vault attachment so the note keeps a visual
   * identity even if the remote host later changes its URL layout.
   */
  snapshotThumbnails: boolean;
  /** Folder (relative to vault root) where snapshots are written. */
  snapshotAttachmentFolder: string;
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
  snapshotThumbnails: false,
  snapshotAttachmentFolder: "IIIF/_attachments",
};

export function toLangOpts(s: IIIFSettings): LanguagePickOptions {
  return { preferred: s.preferredLanguages };
}
