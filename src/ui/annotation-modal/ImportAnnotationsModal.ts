import { App, Modal, Setting } from "obsidian";

export type ImportSourceHandler = (source: string) => Promise<void>;

/**
 * Single-field prompt: vault path or `https://…` URL pointing at a
 * Web Annotation JSON-LD document. Kept deliberately small — the
 * heavy lifting (fetch, parse, render) lives in the command.
 */
export class ImportAnnotationsModal extends Modal {
  private source = "";

  constructor(
    app: App,
    private readonly onSubmit: ImportSourceHandler,
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.style.width = "min(640px, 90vw)";
    this.contentEl.empty();
    this.contentEl.addClass("iiif-annotation-modal");
    this.contentEl.createEl("h2", { text: "Import Web Annotations" });
    this.contentEl.createEl("p", {
      text: "Paste either a vault file path (e.g. IIIF/notes.annotations.json) or an https URL pointing at a Web Annotation JSON-LD document. Annotations are inserted at the cursor of the active note.",
      cls: "iiif-am-hint",
    });

    new Setting(this.contentEl)
      .setName("Source")
      .addText((t) => {
        t.inputEl.style.width = "100%";
        t.setPlaceholder("IIIF/notes.annotations.json or https://…");
        t.onChange((v) => {
          this.source = v;
        });
        t.inputEl.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            void this.commit();
          }
        });
        setTimeout(() => t.inputEl.focus(), 0);
      });

    const bar = this.contentEl.createDiv({ cls: "iiif-am-actions" });
    const cancel = bar.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const submit = bar.createEl("button", { text: "Import", cls: "mod-cta" });
    submit.addEventListener("click", () => void this.commit());
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async commit(): Promise<void> {
    const source = this.source.trim();
    if (source.length === 0) return;
    this.close();
    await this.onSubmit(source);
  }
}
