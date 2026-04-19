import { App, Modal, Notice, Setting } from "obsidian";
import { fetchJson, ManifestFetchError } from "../../core/http/fetcher.ts";
import { buildThumbnailUrl } from "../../core/iiif/image-api.ts";
import { IIIFParseError, parseManifest } from "../../core/iiif/parser.ts";
import {
  clampRect,
  displayToSource,
  normalizeDrag,
  type Rect,
  rectIsTrivial,
} from "../../core/iiif/region-math.ts";
import type { IIIFCanvas, IIIFManifest } from "../../core/iiif/types.ts";
import { buildRegionSnippet } from "../../core/note/region-snippet.ts";
import type { IIIFSettings } from "../../settings/types.ts";

export type RegionInsertHandler = (snippet: string) => void;

type Phase = "source" | "canvas" | "region" | "done";

interface RegionPickerState {
  phase: Phase;
  url: string;
  fetching: boolean;
  manifest: IIIFManifest | null;
  selectedCanvas: IIIFCanvas | null;
  displayDim: { w: number; h: number }; // rendered thumbnail size in CSS px
  selectionDisplay: Rect | null; // selection in display px
  caption: string;
}

/**
 * Three-step picker:
 *   1. (optional) paste a manifest URL if we don't already have one
 *   2. pick a canvas from the thumbnail grid
 *   3. draw a rectangle on the canvas
 * Then: preview → insert a Markdown image embed with a cropped IIIF
 * Image API URL at the user's cursor.
 */
export class RegionPickerModal extends Modal {
  private state: RegionPickerState;

  constructor(
    app: App,
    private readonly settings: IIIFSettings,
    initialManifest: IIIFManifest | null,
    private readonly onInsert: RegionInsertHandler,
  ) {
    super(app);
    this.state = {
      phase: initialManifest ? "canvas" : "source",
      url: "",
      fetching: false,
      manifest: initialManifest,
      selectedCanvas: null,
      displayDim: { w: 0, h: 0 },
      selectionDisplay: null,
      caption: "",
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
    this.contentEl.addClass("iiif-region-picker");
    this.renderHeader();
    switch (this.state.phase) {
      case "source":
        this.renderSourceStep();
        break;
      case "canvas":
        this.renderCanvasStep();
        break;
      case "region":
        this.renderRegionStep();
        break;
      case "done":
        this.renderDoneStep();
        break;
    }
  }

  private renderHeader(): void {
    const hdr = this.contentEl.createDiv({ cls: "iiif-rp-header" });
    hdr.createEl("h2", { text: "Insert IIIF region" });

    const steps: Array<{ id: Phase; label: string }> = [
      { id: "source", label: "1. Source" },
      { id: "canvas", label: "2. Canvas" },
      { id: "region", label: "3. Region" },
      { id: "done", label: "4. Preview" },
    ];
    const bc = hdr.createDiv({ cls: "iiif-rp-breadcrumb" });
    for (const s of steps) {
      const span = bc.createSpan({ text: s.label });
      if (s.id === this.state.phase) span.addClass("iiif-rp-active");
      bc.createSpan({ text: " › " });
    }
    bc.lastChild?.remove(); // trailing separator
  }

  // ---------- phase: source ----------

  private renderSourceStep(): void {
    const body = this.contentEl.createDiv({ cls: "iiif-rp-body" });
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

  private async fetchManifest(): Promise<void> {
    if (this.state.fetching) return;
    this.state.fetching = true;
    this.render();
    try {
      const raw = await fetchJson(this.state.url);
      this.state.manifest = parseManifest(raw, {
        preferredLanguages: this.settings.preferredLanguages,
      });
      this.state.phase = "canvas";
    } catch (e) {
      new Notice(formatErrorForUser(e));
    } finally {
      this.state.fetching = false;
      this.render();
    }
  }

  // ---------- phase: canvas ----------

  private renderCanvasStep(): void {
    const m = this.state.manifest;
    if (!m) return;
    const body = this.contentEl.createDiv({ cls: "iiif-rp-body" });
    body.createEl("p", {
      text: `${m.label} — ${m.canvases.length} canvas${m.canvases.length === 1 ? "" : "es"}`,
      cls: "iiif-rp-subtitle",
    });

    const grid = body.createDiv({ cls: "iiif-rp-grid" });
    const apiV = m.version === "2" ? "2" : "3";
    for (const [index, canvas] of m.canvases.entries()) {
      const tile = grid.createDiv({ cls: "iiif-rp-tile" });
      tile.setAttr("role", "button");
      tile.setAttr("tabindex", "0");
      tile.setAttr("aria-label", `Canvas ${index + 1}: ${canvas.label}`);

      const thumbUrl = canvas.imageService?.id
        ? buildThumbnailUrl(canvas.imageService.id, 200, apiV)
        : canvas.thumbnail;
      if (thumbUrl) {
        const img = tile.createEl("img");
        img.src = thumbUrl;
        img.loading = "lazy";
        img.alt = canvas.label;
      } else {
        tile.createDiv({ cls: "iiif-rp-no-thumb", text: "no preview" });
      }
      tile.createDiv({ cls: "iiif-rp-tile-label", text: `${index + 1}. ${canvas.label}` });

      const select = (): void => {
        if (!canvas.imageService?.id) {
          new Notice("This canvas has no IIIF Image service — cannot crop a region.");
          return;
        }
        this.state.selectedCanvas = canvas;
        this.state.selectionDisplay = null;
        this.state.phase = "region";
        this.render();
      };
      tile.addEventListener("click", select);
      tile.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          select();
        }
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
    ]);
  }

  // ---------- phase: region ----------

  private renderRegionStep(): void {
    const canvas = this.state.selectedCanvas;
    const manifest = this.state.manifest;
    if (!canvas || !manifest) return;
    const service = canvas.imageService?.id;
    if (!service) return;
    const apiV = manifest.version === "2" ? "2" : "3";

    const body = this.contentEl.createDiv({ cls: "iiif-rp-body" });
    body.createEl("p", {
      text: `${canvas.label} — ${canvas.width}×${canvas.height}px. Drag to select a region.`,
      cls: "iiif-rp-subtitle",
    });

    const stage = body.createDiv({ cls: "iiif-rp-stage" });
    const img = stage.createEl("img", { cls: "iiif-rp-image" });
    img.src = buildThumbnailUrl(service, this.settings.regionPickerDisplayWidth, apiV);
    img.alt = canvas.label;
    img.draggable = false;

    const overlay = stage.createDiv({ cls: "iiif-rp-overlay" });
    const selRect = overlay.createDiv({ cls: "iiif-rp-selection" });
    selRect.style.display = "none";

    const readout = body.createDiv({ cls: "iiif-rp-readout" });
    readout.setText("Drag inside the image to draw a selection.");

    const refreshReadout = (): void => {
      const sel = this.state.selectionDisplay;
      if (!sel) {
        readout.setText("Drag inside the image to draw a selection.");
        return;
      }
      const src = displayToSource(sel, this.state.displayDim, {
        w: canvas.width,
        h: canvas.height,
      });
      readout.setText(
        `Source region: x=${src.x}, y=${src.y}, ${src.w}×${src.h}px ` +
          `(original ${canvas.width}×${canvas.height})`,
      );
    };

    const drawSelection = (): void => {
      const sel = this.state.selectionDisplay;
      if (!sel) {
        selRect.style.display = "none";
        return;
      }
      selRect.style.display = "block";
      selRect.style.left = `${sel.x}px`;
      selRect.style.top = `${sel.y}px`;
      selRect.style.width = `${sel.w}px`;
      selRect.style.height = `${sel.h}px`;
    };

    img.addEventListener("load", () => {
      this.state.displayDim = { w: img.clientWidth, h: img.clientHeight };
      overlay.style.width = `${img.clientWidth}px`;
      overlay.style.height = `${img.clientHeight}px`;
      drawSelection();
      refreshReadout();
    });

    let dragStart: { x: number; y: number } | null = null;
    overlay.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      overlay.setPointerCapture(ev.pointerId);
      const rect = overlay.getBoundingClientRect();
      dragStart = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      this.state.selectionDisplay = { x: dragStart.x, y: dragStart.y, w: 0, h: 0 };
      drawSelection();
      refreshReadout();
    });

    overlay.addEventListener("pointermove", (ev) => {
      if (!dragStart) return;
      const rect = overlay.getBoundingClientRect();
      const current = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      const raw = normalizeDrag(dragStart, current);
      this.state.selectionDisplay = clampRect(raw, this.state.displayDim);
      drawSelection();
      refreshReadout();
    });

    const endDrag = (ev: PointerEvent): void => {
      if (!dragStart) return;
      dragStart = null;
      if (overlay.hasPointerCapture(ev.pointerId)) overlay.releasePointerCapture(ev.pointerId);
    };
    overlay.addEventListener("pointerup", endDrag);
    overlay.addEventListener("pointercancel", endDrag);

    this.renderActions([
      {
        label: "Back",
        onClick: () => {
          this.state.phase = "canvas";
          this.render();
        },
      },
      {
        label: "Reset",
        onClick: () => {
          this.state.selectionDisplay = null;
          drawSelection();
          refreshReadout();
        },
      },
      {
        label: "Next",
        cls: "mod-cta",
        disabled: !this.state.selectionDisplay || rectIsTrivial(this.state.selectionDisplay),
        onClick: () => {
          this.state.phase = "done";
          this.render();
        },
      },
    ]);
  }

  // ---------- phase: done ----------

  private renderDoneStep(): void {
    const canvas = this.state.selectedCanvas;
    const manifest = this.state.manifest;
    const selection = this.state.selectionDisplay;
    if (!canvas || !manifest || !selection) return;
    const service = canvas.imageService?.id;
    if (!service) return;

    const source = displayToSource(selection, this.state.displayDim, {
      w: canvas.width,
      h: canvas.height,
    });
    const apiV = manifest.version === "2" ? "2" : "3";
    const snippet = buildRegionSnippet({
      service,
      source,
      displayWidth: this.settings.regionInsertWidth,
      apiVersion: apiV,
      caption: this.state.caption || `${manifest.label} — ${canvas.label}`,
    });

    const body = this.contentEl.createDiv({ cls: "iiif-rp-body" });
    body.createEl("p", {
      text: `Region ${source.w}×${source.h}px (from ${canvas.width}×${canvas.height}).`,
      cls: "iiif-rp-subtitle",
    });

    const preview = body.createDiv({ cls: "iiif-rp-preview" });
    const img = preview.createEl("img");
    img.src = extractUrl(snippet);
    img.style.maxWidth = "100%";
    img.alt = "region preview";

    new Setting(body)
      .setName("Caption")
      .setDesc("Shown inside the Markdown embed — leave blank to use a default.")
      .addText((t) => {
        t.inputEl.style.width = "100%";
        t.setValue(this.state.caption);
        t.setPlaceholder(`${manifest.label} — ${canvas.label}`);
        t.onChange((v) => {
          this.state.caption = v;
        });
      });

    body.createEl("p", { text: "Markdown that will be inserted:", cls: "iiif-rp-subtitle" });
    const code = body.createEl("pre", { cls: "iiif-rp-code" });
    code.setText(snippetWith(this.state.caption, manifest.label, canvas.label, snippet));

    this.renderActions([
      {
        label: "Back",
        onClick: () => {
          this.state.phase = "region";
          this.render();
        },
      },
      { label: "Cancel", onClick: () => this.close() },
      {
        label: "Insert",
        cls: "mod-cta",
        onClick: () => {
          const finalSnippet = buildRegionSnippet({
            service,
            source,
            displayWidth: this.settings.regionInsertWidth,
            apiVersion: apiV,
            caption: this.state.caption || `${manifest.label} — ${canvas.label}`,
          });
          this.onInsert(finalSnippet);
          this.close();
        },
      },
    ]);
  }

  // ---------- shared ----------

  private renderActions(
    buttons: Array<{ label: string; cls?: string; disabled?: boolean; onClick: () => void }>,
  ): void {
    const bar = this.contentEl.createDiv({ cls: "iiif-rp-actions" });
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

function extractUrl(mdImage: string): string {
  const m = mdImage.match(/\]\(([^)]+)\)/);
  return m ? m[1]! : "";
}

function snippetWith(
  caption: string,
  manifestLabel: string,
  canvasLabel: string,
  baseSnippet: string,
): string {
  if (caption.length > 0) return baseSnippet;
  return baseSnippet.replace(/^\!\[[^\]]*\]/, `![${manifestLabel} — ${canvasLabel}]`);
}
