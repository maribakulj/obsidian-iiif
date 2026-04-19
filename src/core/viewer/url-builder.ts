import { PRESETS, templateIsValid } from "./presets.ts";
import type { ViewerKind, ViewerPreset } from "./types.ts";

export class ViewerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewerConfigError";
  }
}

export interface ViewerBuildInput {
  kind: ViewerKind;
  /** Required when `kind === 'custom'`. */
  customTemplate?: string;
  manifestUrl: string;
}

export interface ResolvedViewer {
  preset: ViewerPreset;
  url: string;
}

/**
 * Resolve a viewer kind + manifest URL into a fully-formed deep link.
 * Throws `ViewerConfigError` when the user is on `custom` without a
 * valid template — callers surface this as a clean settings prompt.
 */
export function buildViewerUrl(input: ViewerBuildInput): ResolvedViewer {
  const preset = resolvePreset(input);
  const url = preset.template.replace(/\{url\}/g, encodeURIComponent(input.manifestUrl));
  return { preset, url };
}

function resolvePreset(input: ViewerBuildInput): ViewerPreset {
  if (input.kind === "custom") {
    const tpl = (input.customTemplate ?? "").trim();
    if (tpl.length === 0) {
      throw new ViewerConfigError(
        "Custom viewer selected but no URL template is configured in settings.",
      );
    }
    if (!templateIsValid(tpl)) {
      throw new ViewerConfigError(
        "Custom viewer template must contain a `{url}` placeholder.",
      );
    }
    return { kind: "custom", label: "Custom viewer", template: tpl };
  }
  return PRESETS[input.kind];
}
