import { App, Modal, Notice, Setting } from "obsidian";
import { fetchJson, ManifestFetchError } from "../../core/http/fetcher.ts";
import { IIIFParseError, parseManifest } from "../../core/iiif/parser.ts";
import type { IIIFManifest } from "../../core/iiif/types.ts";
import type { IIIFSettings } from "../../settings/types.ts";

export type ImportHandler = (manifest: IIIFManifest, sourceUrl: string) => Promise<void>;

/**
 * Two-step modal: paste a manifest URL, fetch + parse to show a preview,
 * then commit the import. Validation happens up front so the user never
 * creates a half-broken note.
 */
export class ImportManifestModal extends Modal {
  private url = "";
  private parsed: IIIFManifest | null = null;
  private fetching = false;
  private importing = false;
  private previewEl!: HTMLElement;
  private actionsEl!: HTMLElement;

  constructor(
    app: App,
    private readonly settings: IIIFSettings,
    private readonly onImport: ImportHandler,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Import IIIF manifest" });

    new Setting(contentEl)
      .setName("Manifest URL")
      .setDesc("Paste the URL of a IIIF Presentation API v2 or v3 manifest.")
      .addText((text) => {
        text.inputEl.style.width = "100%";
        text.setPlaceholder("https://example.org/iiif/.../manifest.json");
        text.onChange((v) => {
          this.url = v;
          this.parsed = null;
          this.renderPreview();
        });
        text.inputEl.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            void this.fetchAndPreview();
          }
        });
        setTimeout(() => text.inputEl.focus(), 0);
      });

    this.previewEl = contentEl.createDiv({ cls: "iiif-import-preview" });
    this.previewEl.style.marginTop = "1em";
    this.actionsEl = contentEl.createDiv({ cls: "iiif-import-actions" });
    this.actionsEl.style.marginTop = "1em";
    this.actionsEl.style.display = "flex";
    this.actionsEl.style.gap = "0.5em";
    this.actionsEl.style.justifyContent = "flex-end";

    this.renderActions();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  // ---------- rendering ----------

  private renderPreview(): void {
    this.previewEl.empty();
    if (this.fetching) {
      this.previewEl.createEl("p", { text: "Fetching…" });
      this.renderActions();
      return;
    }
    if (!this.parsed) {
      this.previewEl.createEl("p", {
        text: "Press Enter or click Fetch to validate the manifest before importing.",
        cls: "iiif-hint",
      });
      this.renderActions();
      return;
    }

    const m = this.parsed;
    const wrap = this.previewEl.createDiv();
    wrap.style.padding = "0.75em";
    wrap.style.border = "1px solid var(--background-modifier-border)";
    wrap.style.borderRadius = "6px";

    wrap.createEl("h3", { text: m.label });

    const meta = wrap.createEl("p");
    meta.createSpan({ text: `IIIF v${m.version}` });
    meta.createSpan({ text: " · " });
    meta.createSpan({ text: `${m.canvases.length} canvas${m.canvases.length === 1 ? "" : "es"}` });
    if (m.provider) {
      meta.createSpan({ text: " · " });
      meta.createSpan({ text: m.provider });
    }

    if (m.thumbnail) {
      const img = wrap.createEl("img");
      img.src = m.thumbnail;
      img.style.maxWidth = "100%";
      img.style.maxHeight = "200px";
      img.style.marginTop = "0.5em";
    }

    if (m.summary) {
      const sum = wrap.createEl("p", { text: m.summary });
      sum.style.fontStyle = "italic";
      sum.style.opacity = "0.8";
    }

    this.renderActions();
  }

  private renderActions(): void {
    this.actionsEl.empty();

    const cancel = this.actionsEl.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());

    if (!this.parsed) {
      const fetchBtn = this.actionsEl.createEl("button", {
        text: this.fetching ? "Fetching…" : "Fetch & preview",
        cls: "mod-cta",
      });
      fetchBtn.disabled = this.fetching || this.url.trim().length === 0;
      fetchBtn.addEventListener("click", () => void this.fetchAndPreview());
      return;
    }

    const importBtn = this.actionsEl.createEl("button", {
      text: this.importing ? "Importing…" : "Import",
      cls: "mod-cta",
    });
    importBtn.disabled = this.importing;
    importBtn.addEventListener("click", () => void this.commitImport());
  }

  // ---------- actions ----------

  private async fetchAndPreview(): Promise<void> {
    if (this.fetching) return;
    if (this.url.trim().length === 0) return;
    this.fetching = true;
    this.renderPreview();
    try {
      const raw = await fetchJson(this.url);
      this.parsed = parseManifest(raw, {
        preferredLanguages: this.settings.preferredLanguages,
      });
    } catch (e) {
      new Notice(formatErrorForUser(e));
      this.parsed = null;
    } finally {
      this.fetching = false;
      this.renderPreview();
    }
  }

  private async commitImport(): Promise<void> {
    if (!this.parsed || this.importing) return;
    this.importing = true;
    this.renderActions();
    try {
      await this.onImport(this.parsed, this.url);
      this.close();
    } catch (e) {
      new Notice(formatErrorForUser(e));
      this.importing = false;
      this.renderActions();
    }
  }
}

function formatErrorForUser(e: unknown): string {
  if (e instanceof ManifestFetchError) return `Fetch failed: ${e.message}`;
  if (e instanceof IIIFParseError) return `Not a valid IIIF manifest: ${e.message}`;
  if (e instanceof Error) return e.message;
  return "Unknown error";
}
