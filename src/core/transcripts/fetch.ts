import { requestUrl } from "obsidian";
import { altoToText } from "./alto.ts";
import { hocrToText } from "./hocr.ts";
import type { TranscriptSource, TranscriptText } from "./types.ts";

export class TranscriptFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscriptFetchError";
  }
}

/**
 * Download a transcript resource as plain text, converting ALTO / hOCR
 * to readable text on the fly. Respects `maxChars` and truncates with
 * an ellipsis marker when the source exceeds it.
 */
export async function fetchTranscriptText(
  source: TranscriptSource,
  opts: { maxChars?: number } = {},
): Promise<TranscriptText> {
  if (source.format === "unknown") {
    throw new TranscriptFetchError(
      `Unknown transcript format for ${source.resource.id}`,
    );
  }

  const rawText = await fetchText(source.resource.id);
  const converted = convert(rawText, source.format);
  const truncated = truncate(converted, opts.maxChars);
  return { source, text: truncated };
}

async function fetchText(url: string): Promise<string> {
  let res;
  try {
    res = await requestUrl({ url, method: "GET", throw: false });
  } catch (e) {
    throw new TranscriptFetchError(`Network error fetching ${url}: ${(e as Error).message}`);
  }
  if (res.status >= 400) {
    throw new TranscriptFetchError(`HTTP ${res.status} on ${url}`);
  }
  return res.text;
}

function convert(text: string, format: TranscriptSource["format"]): string {
  switch (format) {
    case "alto":
      return altoToText(text);
    case "hocr":
      return hocrToText(text);
    case "plain":
      return text.trim();
    default:
      return text;
  }
}

function truncate(text: string, maxChars: number | undefined): string {
  if (!maxChars || maxChars <= 0 || text.length <= maxChars) return text;
  return text.slice(0, maxChars).trimEnd() + "\n\n… (truncated)";
}
