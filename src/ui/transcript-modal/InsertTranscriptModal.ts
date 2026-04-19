import { App, Modal, Notice, Setting } from "obsidian";
import { fetchJson, ManifestFetchError } from "../../core/http/fetcher.ts";
import { IIIFParseError, parseManifest } from "../../core/iiif/parser.ts";
import type { IIIFManifest } from "../../core/iiif/types.ts";
import { collectTranscripts } from "../../core/transcripts/detect.ts";
import { fetchTranscriptText, TranscriptFetchError } from "../../core/transcripts/fetch.ts";
import type { TranscriptSource } from "../../core/transcripts/types.ts";
import type { IIIFSettings } from "../../settings/types.ts";

export type TranscriptInsertHandler = (snippet: string) => void;

type Phase = "source" | "pick";

interface TranscriptState {
  phase: Phase;
  url: string;
  fetching: boolean;
  inserting: boolean;
  manifest: IIIFManifest | null;
}

/**
 * Lists every ALTO / hOCR / plain-text transcript declared in a
 * manifest's `seeAlso` (manifest-level and per-canvas). User picks
 * one, we download and convert it, then insert a titled Markdown
 * section at the cursor.
 */
export class InsertTranscriptModal extends Modal {
  private state: TranscriptState;

  constructor(
    app: App,
    private readonly settings: IIIFSettings,
    initialManifest: IIIFManifest | null,
    private readonly onInsert: TranscriptInsertHandler,
  ) {
    super(app);
    this.state = {
      phase: initialManifest ? "pick" : "source",
      url: "",
      fetching: false,
      inserting: false,
      manifest: initialManifest,
    };
  }

  onOpen(): void {
    this.modalEl.style.width = "min(720px, 90vw)";
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.addClass("iiif-transcript-modal");
    this.contentEl.createEl("h2", { text: "Insert IIIF transcript" });
    if (this.state.phase === "source") this.renderSource();
    else this.renderPick();
  }

  private renderSource(): void {
    const body = this.contentEl.createDiv({ cls: "iiif-tm-body" });
    new Setting(body)
      .setName("Manifest URL")
      .setDesc("Paste a IIIF Presentation API v2 or v3 manifest URL.")
      .addText((t) => {
        t.inputEl.style.width = "100%";
        t.setPlaceholder("https://example.org/iiif/.../manifest.json");
        t.setValue(this.state.url);
        t.onChange((v) => {
          this.state.url = v;
        });
        t.inputEl.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            void this.fetchManifest();
          }
        });
        setTimeout(() => t.inputEl.focus(), 0);
      });

    this.renderActions([
      { label: "Cancel", onClick: () => this.close() },
      {
        label: this.state.fetching ? "Fetching…" : "Next",
        cls: "mod-cta",
        disabled: this.state.fetching || this.state.url.trim().length === 0,
        onClick: () => void this.fetchManifest(),
      },
    ]);
  }

  private renderPick(): void {
    const m = this.state.manifest;
    if (!m) return;
    const body = this.contentEl.createDiv({ cls: "iiif-tm-body" });
    body.createEl("p", { text: m.label, cls: "iiif-tm-subtitle" });

    const transcripts = collectTranscripts(m).filter((t) => t.format !== "unknown");
    if (transcripts.length === 0) {
      body.createEl("p", {
        text:
          "This manifest declares no ALTO, hOCR, or plain-text transcripts in its seeAlso arrays.",
        cls: "iiif-tm-empty",
      });
      this.renderActions([
        {
          label: "Back",
          onClick: () => {
            this.state.phase = "source";
            this.render();
          },
        },
        { label: "Close", onClick: () => this.close() },
      ]);
      return;
    }

    const list = body.createDiv({ cls: "iiif-tm-list" });
    for (const t of transcripts) {
      this.renderTranscriptRow(list, t);
    }

    this.renderActions([
      {
        label: "Back",
        onClick: () => {
          this.state.phase = "source";
          this.render();
        },
      },
      { label: "Cancel", onClick: () => this.close() },
    ]);
  }

  private renderTranscriptRow(parent: HTMLElement, source: TranscriptSource): void {
    const row = parent.createDiv({ cls: "iiif-tm-row" });
    const main = row.createDiv({ cls: "iiif-tm-row-main" });
    main.createDiv({
      cls: "iiif-tm-row-title",
      text: source.resource.label ?? source.resource.id.split("/").pop() ?? source.resource.id,
    });
    const meta = main.createDiv({ cls: "iiif-tm-row-meta" });
    meta.createSpan({ text: source.format.toUpperCase() });
    meta.createSpan({ text: " · " });
    meta.createSpan({
      text:
        source.scope.kind === "manifest"
          ? "whole manifest"
          : `canvas ${source.scope.canvasIndex + 1}: ${source.scope.canvasLabel}`,
    });
    if (source.resource.format) {
      meta.createSpan({ text: " · " });
      meta.createSpan({ text: source.resource.format });
    }

    const btn = row.createEl("button", { text: "Insert", cls: "mod-cta" });
    btn.addEventListener("click", () => void this.insertTranscript(source));
  }

  private async fetchManifest(): Promise<void> {
    if (this.state.fetching) return;
    this.state.fetching = true;
    this.render();
    try {
      const raw = await fetchJson(this.state.url);
      this.state.manifest = parseManifest(raw, {
        preferredLanguages: this.settings.preferredLanguages,
      });
      this.state.phase = "pick";
    } catch (e) {
      new Notice(formatErrorForUser(e));
    } finally {
      this.state.fetching = false;
      this.render();
    }
  }

  private async insertTranscript(source: TranscriptSource): Promise<void> {
    if (this.state.inserting) return;
    this.state.inserting = true;
    const notice = new Notice("Fetching transcript…", 0);
    try {
      const result = await fetchTranscriptText(source, {
        maxChars: this.settings.transcriptMaxChars,
      });
      const heading = buildHeading(source, this.state.manifest);
      const snippet = `## ${heading}\n\n${result.text.trim()}\n`;
      this.onInsert(snippet);
      this.close();
    } catch (e) {
      new Notice(formatErrorForUser(e));
      this.state.inserting = false;
    } finally {
      notice.hide();
    }
  }

  private renderActions(
    buttons: Array<{ label: string; cls?: string; disabled?: boolean; onClick: () => void }>,
  ): void {
    const bar = this.contentEl.createDiv({ cls: "iiif-tm-actions" });
    for (const b of buttons) {
      const el = bar.createEl("button", { text: b.label });
      if (b.cls) el.addClass(b.cls);
      if (b.disabled) el.disabled = true;
      el.addEventListener("click", b.onClick);
    }
  }
}

function buildHeading(source: TranscriptSource, manifest: IIIFManifest | null): string {
  const fmt = source.format.toUpperCase();
  if (source.scope.kind === "manifest") {
    return `Transcript — ${manifest?.label ?? "IIIF manifest"} (${fmt})`;
  }
  return `Transcript — ${source.scope.canvasLabel} (${fmt})`;
}

function formatErrorForUser(e: unknown): string {
  if (e instanceof ManifestFetchError) return `Fetch failed: ${e.message}`;
  if (e instanceof IIIFParseError) return `Not a valid IIIF manifest: ${e.message}`;
  if (e instanceof TranscriptFetchError) return `Transcript fetch failed: ${e.message}`;
  if (e instanceof Error) return e.message;
  return "Unknown error";
}
