import { App, Modal, Notice, Setting } from "obsidian";
import {
  fetchAndImportCollection,
  notifyFailures,
  type CollectionImportContext,
  type CollectionImportResult,
} from "../../commands/importCollection.ts";
import { fetchJson, ManifestFetchError } from "../../core/http/fetcher.ts";
import { parseCollection } from "../../core/iiif/parser.ts";
import type { IIIFCollection } from "../../core/iiif/types.ts";
import { IIIFParseError } from "../../core/iiif/parser.ts";

type Phase = "source" | "preview" | "importing" | "done";

interface CollectionState {
  phase: Phase;
  url: string;
  fetching: boolean;
  collection: IIIFCollection | null;
  progress: { done: number; total: number };
  result: CollectionImportResult | null;
}

/**
 * URL → preview → bulk import → summary. Fetches and parses the
 * collection first so the user sees what they're about to create;
 * then imports all `Manifest` items concurrently with a progress bar.
 */
export class ImportCollectionModal extends Modal {
  private state: CollectionState;

  constructor(
    app: App,
    private readonly ctx: CollectionImportContext,
  ) {
    super(app);
    this.state = {
      phase: "source",
      url: "",
      fetching: false,
      collection: null,
      progress: { done: 0, total: 0 },
      result: null,
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
    this.contentEl.addClass("iiif-collection-modal");
    this.contentEl.createEl("h2", { text: "Import IIIF collection" });
    switch (this.state.phase) {
      case "source":
        this.renderSource();
        break;
      case "preview":
        this.renderPreview();
        break;
      case "importing":
        this.renderImporting();
        break;
      case "done":
        this.renderDone();
        break;
    }
  }

  private renderSource(): void {
    const body = this.contentEl.createDiv({ cls: "iiif-col-body" });
    new Setting(body)
      .setName("Collection URL")
      .setDesc("Paste a IIIF Presentation API v2 or v3 Collection URL.")
      .addText((t) => {
        t.inputEl.style.width = "100%";
        t.setPlaceholder("https://example.org/iiif/collection/beatus");
        t.setValue(this.state.url);
        t.onChange((v) => {
          this.state.url = v;
        });
        t.inputEl.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            void this.fetchCollection();
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
        onClick: () => void this.fetchCollection(),
      },
    ]);
  }

  private renderPreview(): void {
    const c = this.state.collection;
    if (!c) return;
    const body = this.contentEl.createDiv({ cls: "iiif-col-body" });
    body.createEl("h3", { text: c.label });
    if (c.summary) {
      body.createEl("p", { text: c.summary, cls: "iiif-col-subtitle" });
    }
    const manifests = c.items.filter((i) => i.type === "Manifest").length;
    const subs = c.items.filter((i) => i.type === "Collection").length;
    const stats = body.createEl("p", { cls: "iiif-col-stats" });
    stats.createSpan({ text: `${c.items.length} item${c.items.length === 1 ? "" : "s"}` });
    stats.createSpan({ text: " · " });
    stats.createSpan({ text: `${manifests} manifest${manifests === 1 ? "" : "s"}` });
    if (subs > 0) {
      stats.createSpan({ text: ` · ${subs} sub-collection${subs === 1 ? "" : "s"} (not imported)` });
    }

    const list = body.createEl("ol", { cls: "iiif-col-list" });
    for (const item of c.items.slice(0, 50)) {
      const li = list.createEl("li");
      li.createSpan({ text: item.label });
      li.createSpan({ text: ` · ${item.type}`, cls: "iiif-col-type" });
    }
    if (c.items.length > 50) {
      body.createEl("p", {
        text: `… ${c.items.length - 50} more`,
        cls: "iiif-col-more",
      });
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
      {
        label: `Import ${manifests} manifest${manifests === 1 ? "" : "s"}`,
        cls: "mod-cta",
        disabled: manifests === 0,
        onClick: () => void this.runImport(),
      },
    ]);
  }

  private renderImporting(): void {
    const body = this.contentEl.createDiv({ cls: "iiif-col-body" });
    const { done, total } = this.state.progress;
    body.createEl("p", {
      text:
        total > 0
          ? `Importing ${done} / ${total} manifests…`
          : "Starting import…",
    });
    const bar = body.createDiv({ cls: "iiif-col-progress" });
    const fill = bar.createDiv({ cls: "iiif-col-progress-fill" });
    fill.style.width = total > 0 ? `${Math.floor((done / total) * 100)}%` : "0%";
  }

  private renderDone(): void {
    const result = this.state.result;
    if (!result) return;
    const body = this.contentEl.createDiv({ cls: "iiif-col-body" });
    const imported = result.reports.filter((r) => r.status === "imported").length;
    const failed = result.reports.filter((r) => r.status === "failed").length;
    const skipped = result.reports.filter((r) => r.status === "skipped").length;

    const heading = body.createEl("p", { cls: "iiif-col-subtitle" });
    heading.createSpan({ text: `${imported} imported` });
    if (failed > 0) heading.createSpan({ text: ` · ${failed} failed`, cls: "iiif-col-failed" });
    if (skipped > 0) heading.createSpan({ text: ` · ${skipped} sub-collection${skipped === 1 ? "" : "s"} skipped` });

    if (failed > 0) {
      body.createEl("h3", { text: "Failures" });
      const list = body.createEl("ul");
      for (const r of result.reports.filter((r) => r.status === "failed")) {
        const li = list.createEl("li");
        li.createSpan({ text: r.entry.label });
        li.createEl("br");
        li.createEl("code", { text: r.errorMessage ?? "unknown error" });
      }
    }

    this.renderActions([
      { label: "Close", onClick: () => this.close() },
      {
        label: "Open index",
        cls: "mod-cta",
        onClick: async () => {
          await this.app.workspace.getLeaf(false).openFile(result.indexFile);
          this.close();
        },
      },
    ]);
  }

  private async fetchCollection(): Promise<void> {
    if (this.state.fetching) return;
    this.state.fetching = true;
    this.render();
    try {
      const raw = await fetchJson(this.state.url);
      this.state.collection = parseCollection(raw, {
        preferredLanguages: this.ctx.settings.preferredLanguages,
      });
      this.state.phase = "preview";
    } catch (e) {
      new Notice(formatErrorForUser(e));
    } finally {
      this.state.fetching = false;
      this.render();
    }
  }

  private async runImport(): Promise<void> {
    if (!this.state.collection) return;
    this.state.phase = "importing";
    const total = this.state.collection.items.length;
    this.state.progress = { done: 0, total };
    this.render();
    try {
      const result = await fetchAndImportCollection(
        this.ctx,
        this.state.url,
        (done, t) => {
          this.state.progress = { done, total: t };
          this.render();
        },
      );
      this.state.result = result;
      this.state.phase = "done";
      notifyFailures(result.reports);
    } catch (e) {
      new Notice(formatErrorForUser(e));
      this.state.phase = "preview";
    }
    this.render();
  }

  private renderActions(
    buttons: Array<{ label: string; cls?: string; disabled?: boolean; onClick: () => void }>,
  ): void {
    const bar = this.contentEl.createDiv({ cls: "iiif-col-actions" });
    for (const b of buttons) {
      const el = bar.createEl("button", { text: b.label });
      if (b.cls) el.addClass(b.cls);
      if (b.disabled) el.disabled = true;
      el.addEventListener("click", b.onClick);
    }
  }
}

function formatErrorForUser(e: unknown): string {
  if (e instanceof ManifestFetchError) return `Fetch failed: ${e.message}`;
  if (e instanceof IIIFParseError) return `Not a valid IIIF resource: ${e.message}`;
  if (e instanceof Error) return e.message;
  return "Unknown error";
}
