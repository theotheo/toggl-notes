import {
  Plugin,
  Notice,
  App,
  PluginSettingTab,
  Setting,
  TFile,
  ButtonComponent,
  TextComponent
} from "obsidian";
import TogglApiClient, { ITimeEntry } from "./TogglClient.js"

interface TogglNotesSettings {
  apiToken: string;
  defaultWorkspaceId: number;
}

const DEFAULT_SETTINGS: Partial<TogglNotesSettings> = {
  // apiToken: "",
};

class TogglManager {
  private client: TogglApiClient;
  public defaultWorkspaceId!: number;

  constructor(token: string, defaultWorkspaceId: number | undefined = undefined) {
    if (defaultWorkspaceId) {
      this.defaultWorkspaceId = defaultWorkspaceId
    }
    this.client = new TogglApiClient(token);
  }

  public async startTimer(description: string): Promise<ITimeEntry> {
    return await this.client.createTimeEntry(description, this.defaultWorkspaceId)
  }

  public async stopTimer(): Promise<boolean> {
    const currentEntry = await this.client.getCurrentTimeEntry();

    if (currentEntry) { // if timer is running
      await this.client.stopTimeEntry(currentEntry.id, currentEntry.workspace_id);

      return true;
    }

    return false;
  }

  public async getUserInfo() {
    return await this.client.getUserInfo()
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
  statusBarItem!: HTMLElement;

  public override async onload(): Promise<void> {
    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));

    await this.loadSettings();

    this.addSettingTab(new TogglNotesTab(this.app, this));
    this.statusBarItem = this.addStatusBarItem()

    this.frontmatter = new FrontMatterManager(this.app);

    this.addCommand({
      id: "start-toggl",
      name: "Start new toggl timer",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();

        if (file) {
          const time_entry = await this.togglManager.startTimer(file.path);
          this.frontmatter.add(file, time_entry.id);

          
          this.statusBarItem.empty()
          this.statusBarItem.createEl("span", { text: "🟢 toggl is running" });
          new Notice("▶ time entries was started");
        }
      }
    });

    this.addCommand({
      id: "stop-toggl",
      name: "Stop current toggl timer",
      callback: async () => {
        if (await this.togglManager.stopTimer()) { // if timer was running
          this.statusBarItem.empty()
          this.statusBarItem.createEl("span", { text: "⚪ toggl is stopped" });

          new Notice("▶ time entries was stopped");
        }
      }
    });

    if (!this.settings.apiToken) {
      this.statusBarItem.empty()
      this.statusBarItem.createEl("span", { text: "❗set api token" });
      return
    }

    this.togglManager = new TogglManager(this.settings.apiToken, this.settings.defaultWorkspaceId);
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

    const workspaceSetting = new Setting(containerEl)
      .setName("Default Workspace")
      .setDesc("")
      .addText((text) =>
        text
          .setPlaceholder("Your default workspace id")
          .setValue(String(this.plugin.settings.defaultWorkspaceId) || "")
          .setDisabled(true)
      )
      
    new Setting(containerEl)
      .addButton((button: ButtonComponent) => {
        button.setButtonText("connect");
        button.onClick(async () => {
          const text = workspaceSetting.components[0] as TextComponent

          try {
            this.plugin.togglManager = new TogglManager(this.plugin.settings.apiToken)
            const defaultWorkspaceId = (await this.plugin.togglManager.getUserInfo())['default_workspace_id'];
            this.plugin.settings.defaultWorkspaceId = defaultWorkspaceId;
            await this.plugin.saveSettings();
            
            this.plugin.togglManager.defaultWorkspaceId = defaultWorkspaceId;

            text.setValue(String(this.plugin.settings.defaultWorkspaceId))
            this.plugin.statusBarItem.empty()
          } catch (e) {

            text.setValue(`${e}`)
          }

        });
        button.setCta();
      })
  }
}