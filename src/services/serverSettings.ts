import fs from 'node:fs';
import path from 'node:path';

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');
const WIN_SETTINGS_DIR = path.join(process.env.LOCALAPPDATA || 'C:/Users/nanoc/AppData/Local', 'AnfetaCalendarLab');
const WIN_SETTINGS_FILE = path.join(WIN_SETTINGS_DIR, 'settings.json');
let memorySettings: any = null;

function cleanToken(token: string | undefined): string {
  if (!token) return '';
  return token.trim().replace(/^[:'"]+|[:'"]+$/g, '');
}

export function ensureEnvLoaded() {
  if (!process.env.NOTION_TOKEN) {
    try {
      const { loadEnvConfig } = require('@next/env');
      loadEnvConfig(process.cwd());
    } catch {
      try {
        const envLocalPath = path.join(process.cwd(), '.env.local');
        if (fs.existsSync(envLocalPath)) {
          const content = fs.readFileSync(envLocalPath, 'utf-8');
          for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eq = trimmed.indexOf('=');
            if (eq > 0) {
              const key = trimmed.slice(0, eq).trim();
              const val = cleanToken(trimmed.slice(eq + 1));
              if (!process.env[key]) {
                process.env[key] = val;
              }
            }
          }
        }
      } catch {}
    }
  }
}

export function getSettings() {
  ensureEnvLoaded();
  let settings = {
    notionToken: cleanToken(process.env.NOTION_TOKEN) || "",
    notionDatabaseId: process.env.NOTION_DATABASE_ID || "",
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
  if (memorySettings) {
    settings = { ...settings, ...memorySettings };
  }
  // Environment variable NOTION_TOKEN (e.g. from .env.local or Vercel) strictly overrides old settings.json values
  if (process.env.NOTION_TOKEN?.trim()) {
    settings.notionToken = cleanToken(process.env.NOTION_TOKEN);
  }
  if (process.env.NOTION_DATABASE_ID) settings.notionDatabaseId = process.env.NOTION_DATABASE_ID;
  if (process.env.DROPBOX_ACCESS_TOKEN) settings.dropboxToken = process.env.DROPBOX_ACCESS_TOKEN;
  return settings;
}

export function saveSettings(data: any) {
  memorySettings = { ...(memorySettings || {}), ...data };
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
