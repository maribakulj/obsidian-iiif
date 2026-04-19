/**
 * W3C Web Annotation Data Model — minimal subset emitted and consumed
 * by the plugin. Targets are always IIIF Canvases with an optional
 * `xywh=` Media Fragments selector for regions; bodies are plain
 * textual bodies derived from Markdown image captions.
 *
 * Spec: https://www.w3.org/TR/annotation-model/
 */

export const WEB_ANNOTATION_CONTEXT = "http://www.w3.org/ns/anno.jsonld";

export interface TextualBody {
  type: "TextualBody";
  value: string;
  format?: string;
  language?: string;
}

export interface FragmentSelector {
  type: "FragmentSelector";
  conformsTo: "http://www.w3.org/TR/media-frags/";
  /** e.g. `xywh=100,200,300,400` */
  value: string;
}

export interface AnnotationTarget {
  type: "SpecificResource";
  /** Canvas URI. */
  source: string;
  selector?: FragmentSelector;
  /** Manifest the canvas belongs to — strongly recommended. */
  partOf?: { id: string; type: "Manifest" };
}

export interface WebAnnotation {
  "@context"?: string | string[];
  id: string;
  type: "Annotation";
  motivation: "commenting" | "describing" | "tagging";
  /** ISO-8601 timestamp. */
  created?: string;
  creator?: string;
  body: TextualBody | TextualBody[];
  /** Single-target form is enough for our use case. */
  target: AnnotationTarget;
}

export interface AnnotationPage {
  "@context": string;
  id: string;
  type: "AnnotationPage";
  /** Manifest the page references — preserved when set. */
  partOf?: { id: string; type: "Manifest" };
  items: WebAnnotation[];
}
