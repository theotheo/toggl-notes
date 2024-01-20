import moment from "moment";
import { Plugin, Notice, App, PluginSettingTab, Setting } from "obsidian";
import { Toggl } from 'toggl-track';

interface TogglNotesSettings {
  apiToken: string;
}

const DEFAULT_SETTINGS: Partial<TogglNotesSettings> = {
  // apiToken: "",
};

export default class TogglNotesPlugin extends Plugin {
  settings: TogglNotesSettings;

  public override async onload(): Promise<void>  {
    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));

    await this.loadSettings();

    this.addSettingTab(new TogglNotesTab(this.app, this));

    const toggl = new Toggl({
      auth: {
        token: this.settings.apiToken
      },
    })

    const togglParams = await toggl.me.get()
    const defaultWorkspaceId = togglParams['default_workspace_id']


    this.addCommand({
      id: "start-toggl",
      name: "Start new toggl timer",
      callback: async () => {
    
        const file = this.app.workspace.getActiveFile()
        if (file) {
          const path = file.path
          const time_entry = await toggl.timeEntry.create(defaultWorkspaceId, {
            'description': path,
            'created_with': "Obsidian client",
            'start': moment().format(),
            'workspace_id': defaultWorkspaceId,
            'duration': -1
          })
      
          const fm = this.app.metadataCache.getCache(file.path)?.frontmatter || {}      
          let time_entries: string[] = fm['_time_entries']

          time_entries.push(String(time_entry.id)) // frontmatter don't good with number

          await this.app.fileManager.processFrontMatter(file, (fm) => fm['_time_entries'] = time_entries);
      
          const item = this.addStatusBarItem();
          item.createEl("span", { text: "🟢 toggl is running" });
          new Notice('▶ time entries was started')
        } 

      },
    });

    this.addCommand({
      id: "stop-toggl",
      name: "Stop current toggl timer",
      callback: async () => {
        const currentEntry = await toggl.timeEntry.current()

        if (currentEntry) { // if timer is running
          await toggl.timeEntry.stop(currentEntry.id, currentEntry.workspace_id)

          const item = this.addStatusBarItem();
          item.createEl("span", { text: "⚪ toggl is stopped" });
          new Notice('▶ time entries was stopped')
        }
      }
    })
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
  plugin: TogglNotesPlugin;

  constructor(app: App, plugin: TogglNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;

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