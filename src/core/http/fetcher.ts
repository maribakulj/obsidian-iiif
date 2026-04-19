import { requestUrl } from "obsidian";

export class ManifestFetchError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ManifestFetchError";
  }
}

/**
 * Fetch a IIIF manifest (or any JSON resource) using Obsidian's CORS-bypass
 * `requestUrl`. Throws `ManifestFetchError` on network, status, or JSON
 * decoding failures so callers can surface a clean message.
 */
export async function fetchJson(url: string): Promise<unknown> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new ManifestFetchError(
      `URL must start with http:// or https:// (got "${trimmed.slice(0, 40)}")`,
    );
  }

  let response;
  try {
    response = await requestUrl({
      url: trimmed,
      method: "GET",
      throw: false,
      headers: { Accept: "application/ld+json, application/json;q=0.9, */*;q=0.5" },
    });
  } catch (e) {
    throw new ManifestFetchError(`Network error fetching ${trimmed}`, e);
  }

  if (response.status >= 400) {
    throw new ManifestFetchError(`HTTP ${response.status} on ${trimmed}`);
  }

  try {
    return response.json;
  } catch (e) {
    throw new ManifestFetchError(
      `Response was not valid JSON (${(e as Error).message})`,
      e,
    );
  }
}
