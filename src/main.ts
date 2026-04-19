import { Plugin } from "obsidian";
import { handleImport } from "./commands/importManifest.ts";
import { DEFAULT_SETTINGS, type IIIFSettings } from "./settings/types.ts";
import { IIIFSettingsTab } from "./settings/SettingsTab.ts";
import { ImportManifestModal } from "./ui/import-modal/ImportManifestModal.ts";

export default class IIIFPlugin extends Plugin {
  settings: IIIFSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "import-manifest",
      name: "Import IIIF manifest from URL",
      callback: () => {
        new ImportManifestModal(this.app, this.settings, async (manifest, url) => {
          await handleImport({ app: this.app, settings: this.settings }, manifest, url);
        }).open();
      },
    });

    this.addSettingTab(new IIIFSettingsTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<IIIFSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
