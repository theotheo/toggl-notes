import {
  Plugin,
  Notice,
  App,
  PluginSettingTab,
  Setting,
  TFile
} from "obsidian";
import TogglApiClient, { ITimeEntry } from "./TogglClient.js"

interface TogglNotesSettings {
  apiToken: string;
}

const DEFAULT_SETTINGS: Partial<TogglNotesSettings> = {
  // apiToken: "",
};

class TogglManager {
  private client: TogglApiClient;

  constructor(token: string) {
    this.client = new TogglApiClient(token);
  }

  public async startTimer(description: string): Promise<ITimeEntry> {
    const userInfo = await this.client.getUserInfo()
    const defaultWorkspaceId = userInfo["default_workspace_id"];

    const timeEntry = await this.client.createTimeEntry(description, defaultWorkspaceId)

    return timeEntry;
  }

  public async stopTimer(): Promise<boolean> {
    const currentEntry = await this.client.getCurrentTimeEntry();

    if (currentEntry) { // if timer is running
      await this.client.stopTimeEntry(currentEntry.id, currentEntry.workspace_id);

      return true;
    }

    return false;
  }

}

class FrontMatterManager {
  private field = "_time_entries";
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  public async add(file: TFile, id: number) {
    const fm = this.app.metadataCache.getCache(file.path)?.frontmatter || {};
    const time_entries: string[] = fm[this.field];
    time_entries.push(String(id)); // frontmatter don't good with number
    await this.app.fileManager.processFrontMatter(file, (fm) => fm[this.field] = time_entries);
  }
}

export default class TogglNotesPlugin extends Plugin {
  settings!: TogglNotesSettings;
  togglManager!: TogglManager;
  frontmatter!: FrontMatterManager;

  public override async onload(): Promise<void> {
    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));

    await this.loadSettings();

    this.addSettingTab(new TogglNotesTab(this.app, this));
    
    this.togglManager = new TogglManager(this.settings.apiToken);    
    this.frontmatter = new FrontMatterManager(this.app);

    this.addCommand({
      id: "start-toggl",
      name: "Start new toggl timer",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();

        if (file) {
          const time_entry = await this.togglManager.startTimer(file.path);
          this.frontmatter.add(file, time_entry.id);

          const item = this.addStatusBarItem();
          item.empty()
          item.createEl("span", { text: "🟢 toggl is running" });
          new Notice("▶ time entries was started");
        }
      }
    });

    this.addCommand({
      id: "stop-toggl",
      name: "Stop current toggl timer",
      callback: async () => {
        if (await this.togglManager.stopTimer()) { // if timer was running
          const item = this.addStatusBarItem();
          item.empty()
          item.createEl("span", { text: "⚪ toggl is stopped" });

          new Notice("▶ time entries was stopped");
        }
      }
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private onLayoutReady(): void {
  }
}


export class TogglNotesTab extends PluginSettingTab {
  override plugin: TogglNotesPlugin;

  constructor(app: App, plugin: TogglNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("API Token")
      .setDesc("You can find it at the bottom of https://track.toggl.com/profile")
      .addText((text) =>
        text
          .setPlaceholder("")
          .setValue(this.plugin.settings.apiToken)
          .onChange(async (value) => {
            this.plugin.settings.apiToken = value;
            await this.plugin.saveSettings();
          })
      );
  }
}