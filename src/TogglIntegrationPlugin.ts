import { Plugin } from "obsidian";

export default class TogglIntegrationPlugin extends Plugin {
  public override onload(): void {
    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));
  }

  private onLayoutReady(): void {
  }
}
