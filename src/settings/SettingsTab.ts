import { App, PluginSettingTab, Setting } from "obsidian";
import type IIIFPlugin from "../main.ts";
import { DEFAULT_SETTINGS } from "./types.ts";

export class IIIFSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: IIIFPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "IIIF Research Companion" });

    new Setting(containerEl)
      .setName("Import folder")
      .setDesc("Folder under your vault root where imported manifests are saved.")
      .addText((t) =>
        t
          .setPlaceholder(DEFAULT_SETTINGS.folder)
          .setValue(this.plugin.settings.folder)
          .onChange(async (v) => {
            this.plugin.settings.folder = v.trim() || DEFAULT_SETTINGS.folder;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Filename template")
      .setDesc("Supports {{label}}, {{id}}, {{version}}.")
      .addText((t) =>
        t
          .setPlaceholder(DEFAULT_SETTINGS.filenameTemplate)
          .setValue(this.plugin.settings.filenameTemplate)
          .onChange(async (v) => {
            this.plugin.settings.filenameTemplate = v.trim() || DEFAULT_SETTINGS.filenameTemplate;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Preferred languages")
      .setDesc("Comma-separated BCP-47 tags, in order of preference (e.g. fr, en, la).")
      .addText((t) =>
        t
          .setPlaceholder("en")
          .setValue(this.plugin.settings.preferredLanguages.join(", "))
          .onChange(async (v) => {
            const langs = v
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            this.plugin.settings.preferredLanguages = langs.length > 0 ? langs : DEFAULT_SETTINGS.preferredLanguages;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Open note after import")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.openAfterImport).onChange(async (v) => {
          this.plugin.settings.openAfterImport = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Header thumbnail width")
      .setDesc("Pixel width requested via the IIIF Image API for the embedded header thumbnail.")
      .addText((t) =>
        t
          .setPlaceholder(String(DEFAULT_SETTINGS.thumbnailWidth))
          .setValue(String(this.plugin.settings.thumbnailWidth))
          .onChange(async (v) => {
            const n = parseInt(v, 10);
            this.plugin.settings.thumbnailWidth = Number.isFinite(n) && n > 0 ? n : DEFAULT_SETTINGS.thumbnailWidth;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Render canvas table")
      .setDesc("Include a table listing each canvas in the imported note body.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.insertCanvasTable).onChange(async (v) => {
          this.plugin.settings.insertCanvasTable = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Max canvases in table")
      .setDesc("Cap the number of rows in the canvas table to keep notes readable.")
      .addText((t) =>
        t
          .setPlaceholder(String(DEFAULT_SETTINGS.maxCanvasesInTable))
          .setValue(String(this.plugin.settings.maxCanvasesInTable))
          .onChange(async (v) => {
            const n = parseInt(v, 10);
            this.plugin.settings.maxCanvasesInTable = Number.isFinite(n) && n > 0 ? n : DEFAULT_SETTINGS.maxCanvasesInTable;
            await this.plugin.saveSettings();
          }),
      );
  }
}
