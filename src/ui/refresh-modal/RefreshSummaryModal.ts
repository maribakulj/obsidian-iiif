import { App, Modal } from "obsidian";
import type { ManifestDiff } from "../../core/iiif/diff.ts";

export type ApplyHandler = () => Promise<void>;

/**
 * Read-only summary of what changed between the note's stored
 * frontmatter and the freshly fetched manifest. Apply commits the
 * scalar/metadata changes to the frontmatter; the note body is left
 * untouched.
 */
export class RefreshSummaryModal extends Modal {
  private applying = false;

  constructor(
    app: App,
    private readonly noteTitle: string,
    private readonly manifestUrl: string,
    private readonly diff: ManifestDiff,
    private readonly onApply: ApplyHandler,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.style.width = "min(700px, 90vw)";
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.addClass("iiif-refresh-modal");
    this.contentEl.createEl("h2", { text: "Refresh summary" });
    const meta = this.contentEl.createEl("p", { cls: "iiif-rm-subtitle" });
    meta.createSpan({ text: this.noteTitle });
    meta.createEl("br");
    meta.createEl("code", { text: this.manifestUrl });

    if (this.diff.unchanged) {
      this.contentEl.createEl("p", {
        text: "No meaningful changes detected. Only the `imported` timestamp will be refreshed.",
        cls: "iiif-rm-unchanged",
      });
    } else {
      this.renderChanges();
    }

    this.renderActions();
  }

  private renderChanges(): void {
    const body = this.contentEl.createDiv({ cls: "iiif-rm-body" });

    if (this.diff.scalarChanges.length > 0) {
      body.createEl("h3", { text: "Changed fields" });
      const list = body.createEl("ul");
      for (const c of this.diff.scalarChanges) {
        const li = list.createEl("li");
        li.createEl("code", { text: c.field });
        li.createSpan({ text: ": " });
        li.createSpan({ text: fmt(c.from) });
        li.createSpan({ text: " → " });
        li.createSpan({ text: fmt(c.to) });
      }
    }

    if (this.diff.metadataChanges.length > 0) {
      body.createEl("h3", { text: "Metadata changes" });
      const list = body.createEl("ul");
      for (const c of this.diff.metadataChanges) {
        const li = list.createEl("li");
        li.createEl("code", { text: c.field });
        li.createSpan({ text: ": " });
        li.createSpan({ text: fmt(c.from) });
        li.createSpan({ text: " → " });
        li.createSpan({ text: fmt(c.to) });
      }
    }

    if (this.diff.addedCanvases.length > 0) {
      body.createEl("h3", { text: `Added canvases (${this.diff.addedCanvases.length})` });
      body.createEl("ul").innerHTML = this.diff.addedCanvases
        .map((c) => `<li>${escapeHtml(c.label)}</li>`)
        .join("");
    }

    if (this.diff.removedCanvases.length > 0) {
      const h = body.createEl("h3", {
        text: `Removed canvases (${this.diff.removedCanvases.length})`,
      });
      h.addClass("iiif-rm-warn");
      body.createEl("p", {
        text:
          "Region embeds or canvas inserts pointing at these canvases may now 404 — verify in the body.",
        cls: "iiif-rm-warn-text",
      });
      body.createEl("ul").innerHTML = this.diff.removedCanvases
        .map((c) => `<li>${escapeHtml(c.label)}</li>`)
        .join("");
    }

    if (this.diff.relabeledCanvases.length > 0) {
      body.createEl("h3", { text: "Relabeled canvases" });
      const list = body.createEl("ul");
      for (const c of this.diff.relabeledCanvases) {
        const li = list.createEl("li");
        li.createSpan({ text: `${c.from} → ${c.to}` });
      }
    }
  }

  private renderActions(): void {
    const bar = this.contentEl.createDiv({ cls: "iiif-rm-actions" });
    const cancel = bar.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const apply = bar.createEl("button", {
      text: this.applying ? "Applying…" : "Apply to frontmatter",
      cls: "mod-cta",
    });
    apply.disabled = this.applying;
    apply.addEventListener("click", async () => {
      if (this.applying) return;
      this.applying = true;
      this.render();
      try {
        await this.onApply();
        this.close();
      } catch (e) {
        this.applying = false;
        this.render();
        throw e;
      }
    });
  }
}

function fmt(v: string | undefined): string {
  return v == null || v === "" ? "(empty)" : v;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
