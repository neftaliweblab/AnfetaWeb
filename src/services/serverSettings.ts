import fs from 'node:fs';import path from 'node:path';
const SETTINGS_FILE=path.join(process.cwd(),'settings.json');
const WIN_SETTINGS_DIR=path.join(process.env.LOCALAPPDATA || 'C:/Users/nanoc/AppData/Local','AnfetaCalendarLab');const WIN_SETTINGS_FILE=path.join(WIN_SETTINGS_DIR,'settings.json');
export function getSettings() {
  let settings = {
    notionToken: process.env.NOTION_TOKEN || "",
    dropboxToken: process.env.DROPBOX_ACCESS_TOKEN || "",
    dropboxPath: process.env.DROPBOX_PATH || "C:\\Users\\nanoc\\Dropbox",
    currentUser: "nneft",
    notionDataSourceId: process.env.NOTION_CALENDAR_DATA_SOURCE_ID || "2eeabd7d-91b7-8193-a131-000b08cd54e2",
    isDryRun: true,
  };
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      settings = { ...settings, ...data };
    } else if (fs.existsSync(WIN_SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(WIN_SETTINGS_FILE, "utf-8"));
      settings = { ...settings, ...data };
    }
  } catch (e) {
    console.error("Error reading settings:", e);
  }
  if (process.env.NOTION_TOKEN) settings.notionToken = process.env.NOTION_TOKEN;
  if (process.env.DROPBOX_ACCESS_TOKEN) settings.dropboxToken = process.env.DROPBOX_ACCESS_TOKEN;
  return settings;
}

export function saveSettings(data: any) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
    if (!fs.existsSync(WIN_SETTINGS_DIR)) {
      fs.mkdirSync(WIN_SETTINGS_DIR, { recursive: true });
    }
    fs.writeFileSync(WIN_SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving settings to disk:", e);
  }
}
