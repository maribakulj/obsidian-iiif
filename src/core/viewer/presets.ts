import type { ViewerKind, ViewerPreset } from "./types.ts";

/**
 * Built-in presets for the major IIIF viewers. These URLs are the
 * public hosted instances; users who run their own can switch to the
 * `custom` kind and provide a template.
 *
 * - Mirador's embed endpoint accepts either `?manifest=` or
 *   `?iiif-content=`; we use the broadly compatible `manifest` param.
 * - Universal Viewer v4 uses a hash-based route with `manifest=`.
 */
export const PRESETS: Record<Exclude<ViewerKind, "custom">, ViewerPreset> = {
  mirador: {
    kind: "mirador",
    label: "Mirador",
    template: "https://projectmirador.org/embed/?manifest={url}",
  },
  universal: {
    kind: "universal",
    label: "Universal Viewer",
    template: "https://uv-v4.netlify.app/#?manifest={url}",
  },
};

/** True when a template contains at least one `{url}` placeholder. */
export function templateIsValid(template: string): boolean {
  return /\{url\}/.test(template);
}
