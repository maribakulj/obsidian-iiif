import { Plugin } from "obsidian";

export default class IIIFPlugin extends Plugin {
  async onload(): Promise<void> {
    console.log("[obsidian-iiif] loaded");
  }

  async onunload(): Promise<void> {
    console.log("[obsidian-iiif] unloaded");
  }
}
