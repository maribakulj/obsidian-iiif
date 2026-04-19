import { App, Modal, Notice, Setting } from "obsidian";
import { fetchJson, ManifestFetchError } from "../../core/http/fetcher.ts";
import { filterCanvases, paginate } from "../../core/iiif/canvas-filter.ts";
import { buildThumbnailUrl } from "../../core/iiif/image-api.ts";
import { IIIFParseError, parseManifest } from "../../core/iiif/parser.ts";
import type { IIIFCanvas, IIIFManifest } from "../../core/iiif/types.ts";
import { buildCanvasBatch } from "../../core/note/canvas-snippet.ts";
import type { IIIFSettings } from "../../settings/types.ts";

export type CanvasInsertHandler = (snippet: string) => void;

type Phase = "source" | "browse";

const PAGE_SIZE = 60;

interface BrowserState {
  phase: Phase;
  url: string;
  fetching: boolean;
  manifest: IIIFManifest | null;
  query: string;
  page: number;
  selected: Set<string>; // canvas ids
}

/**
 * Thumbnail grid with search, pagination, and multi-select. Produces
 * a batch of Markdown image embeds for the picked canvases.
 */
export class CanvasBrowserModal extends Modal {
  private state: BrowserState;

  constructor(
    app: App,
    private readonly settings: IIIFSettings,
    initialManifest: IIIFManifest | null,
    private readonly onInsert: CanvasInsertHandler,
  ) {
    super(app);
    this.state = {
      phase: initialManifest ? "browse" : "source",
      url: "",
      fetching: false,
      manifest: initialManifest,
      query: "",
      page: 1,
      selected: new Set(),
    };
  }

  onOpen(): void {
    this.modalEl.style.width = "min(1100px, 90vw)";
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  // ---------- rendering ----------

  private render(): void {
    this.contentEl.empty();
    this.contentEl.addClass("iiif-canvas-browser");
    this.contentEl.createEl("h2", { text: "Browse IIIF canvases" });
    if (this.state.phase === "source") {
      this.renderSource();
    } else {
      this.renderBrowse();
    }
  }

  private renderSource(): void {
    const body = this.contentEl.createDiv({ cls: "iiif-cb-body" });
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

  private renderBrowse(): void {
    const m = this.state.manifest;
    if (!m) return;
    const body = this.contentEl.createDiv({ cls: "iiif-cb-body" });

    body.createEl("p", {
      text: `${m.label} — ${m.canvases.length} canvas${m.canvases.length === 1 ? "" : "es"}`,
      cls: "iiif-cb-subtitle",
    });

    // Search bar
    const searchRow = body.createDiv({ cls: "iiif-cb-search" });
    const search = searchRow.createEl("input");
    search.type = "search";
    search.placeholder = "Filter by label (e.g. f. 127)…";
    search.value = this.state.query;
    search.style.width = "100%";
    search.addEventListener("input", () => {
      this.state.query = search.value;
      this.state.page = 1;
      this.rerenderGrid();
    });
    setTimeout(() => search.focus(), 0);

    // Grid + pagination placeholders (rerendered together)
    body.createDiv({ cls: "iiif-cb-grid-wrap" });
    this.rerenderGrid();

    this.renderActions([
      {
        label: "Back",
        onClick: () => {
          this.state.phase = "source";
          this.render();
        },
      },
      {
        label: "Clear selection",
        disabled: this.state.selected.size === 0,
        onClick: () => {
          this.state.selected.clear();
          this.rerenderGrid();
        },
      },
      { label: "Cancel", onClick: () => this.close() },
      {
        label: `Insert${this.state.selected.size > 0 ? ` (${this.state.selected.size})` : ""}`,
        cls: "mod-cta",
        disabled: this.state.selected.size === 0,
        onClick: () => this.commitInsert(),
      },
    ]);
  }

  private rerenderGrid(): void {
    const m = this.state.manifest;
    if (!m) return;
    const wrap = this.contentEl.querySelector(".iiif-cb-grid-wrap") as HTMLElement | null;
    if (!wrap) return;
    wrap.empty();

    const filtered = filterCanvases(m.canvases, this.state.query);
    const page = paginate(filtered, this.state.page, PAGE_SIZE);

    if (filtered.length === 0) {
      wrap.createEl("p", { text: "No canvases match.", cls: "iiif-cb-empty" });
      this.rerenderActions();
      return;
    }

    const grid = wrap.createDiv({ cls: "iiif-cb-grid" });
    const apiV = m.version === "2" ? "2" : "3";
    for (const canvas of page.items) {
      this.renderTile(grid, canvas, apiV);
    }

    // Pagination
    if (page.totalPages > 1) {
      const pg = wrap.createDiv({ cls: "iiif-cb-pagination" });
      const prev = pg.createEl("button", { text: "← Prev" });
      prev.disabled = page.page <= 1;
      prev.addEventListener("click", () => {
        this.state.page = Math.max(1, this.state.page - 1);
        this.rerenderGrid();
      });
      pg.createSpan({ text: `Page ${page.page} / ${page.totalPages} · ${page.total} matches` });
      const next = pg.createEl("button", { text: "Next →" });
      next.disabled = page.page >= page.totalPages;
      next.addEventListener("click", () => {
        this.state.page = Math.min(page.totalPages, this.state.page + 1);
        this.rerenderGrid();
      });
    }

    this.rerenderActions();
  }

  private renderTile(grid: HTMLElement, canvas: IIIFCanvas, apiV: "2" | "3"): void {
    const tile = grid.createDiv({ cls: "iiif-cb-tile" });
    tile.setAttr("role", "button");
    tile.setAttr("tabindex", "0");
    tile.setAttr("aria-pressed", String(this.state.selected.has(canvas.id)));
    if (this.state.selected.has(canvas.id)) tile.addClass("iiif-cb-selected");
    tile.setAttr("aria-label", `Canvas: ${canvas.label}`);

    const thumbUrl = canvas.imageService?.id
      ? buildThumbnailUrl(canvas.imageService.id, 200, apiV)
      : canvas.thumbnail;
    if (thumbUrl) {
      const img = tile.createEl("img");
      img.src = thumbUrl;
      img.loading = "lazy";
      img.alt = canvas.label;
    } else {
      tile.createDiv({ cls: "iiif-cb-no-thumb", text: "no preview" });
    }
    tile.createDiv({ cls: "iiif-cb-tile-label", text: canvas.label });

    const toggle = (): void => {
      if (this.state.selected.has(canvas.id)) {
        this.state.selected.delete(canvas.id);
      } else {
        this.state.selected.add(canvas.id);
      }
      this.rerenderGrid();
    };
    tile.addEventListener("click", toggle);
    tile.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        toggle();
      }
    });
  }

  private rerenderActions(): void {
    // Action bar state depends on selection size, so rebuild it.
    const bar = this.contentEl.querySelector(".iiif-cb-actions") as HTMLElement | null;
    if (bar) bar.remove();
    this.renderActions([
      {
        label: "Back",
        onClick: () => {
          this.state.phase = "source";
          this.render();
        },
      },
      {
        label: "Clear selection",
        disabled: this.state.selected.size === 0,
        onClick: () => {
          this.state.selected.clear();
          this.rerenderGrid();
        },
      },
      { label: "Cancel", onClick: () => this.close() },
      {
        label: `Insert${this.state.selected.size > 0 ? ` (${this.state.selected.size})` : ""}`,
        cls: "mod-cta",
        disabled: this.state.selected.size === 0,
        onClick: () => this.commitInsert(),
      },
    ]);
  }

  // ---------- actions ----------

  private async fetchManifest(): Promise<void> {
    if (this.state.fetching) return;
    this.state.fetching = true;
    this.render();
    try {
      const raw = await fetchJson(this.state.url);
      this.state.manifest = parseManifest(raw, {
        preferredLanguages: this.settings.preferredLanguages,
      });
      this.state.phase = "browse";
      this.state.selected.clear();
      this.state.page = 1;
    } catch (e) {
      new Notice(formatErrorForUser(e));
    } finally {
      this.state.fetching = false;
      this.render();
    }
  }

  private commitInsert(): void {
    const m = this.state.manifest;
    if (!m || this.state.selected.size === 0) return;
    // Preserve manifest order regardless of click order.
    const picked = m.canvases.filter((c) => this.state.selected.has(c.id));
    try {
      const snippet = buildCanvasBatch(picked, {
        insertWidth: this.settings.regionInsertWidth,
        apiVersion: m.version === "2" ? "2" : "3",
      });
      this.onInsert(snippet);
      this.close();
    } catch (e) {
      new Notice(formatErrorForUser(e));
    }
  }

  private renderActions(
    buttons: Array<{ label: string; cls?: string; disabled?: boolean; onClick: () => void }>,
  ): void {
    const bar = this.contentEl.createDiv({ cls: "iiif-cb-actions" });
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
  if (e instanceof IIIFParseError) return `Not a valid IIIF manifest: ${e.message}`;
  if (e instanceof Error) return e.message;
  return "Unknown error";
}
