/**
 * Identifiers for the external IIIF viewers the plugin knows how to
 * hand off to. `custom` means "use the user-supplied URL template" —
 * handy for self-hosted Mirador/UV instances or other viewers.
 */
export type ViewerKind = "mirador" | "universal" | "custom";

export interface ViewerPreset {
  kind: ViewerKind;
  label: string;
  /**
   * URL template with `{url}` placeholder for the (URL-encoded)
   * IIIF manifest URL. Additional placeholders in the future:
   *   `{contentState}` — base64url-encoded IIIF Content State
   */
  template: string;
}
