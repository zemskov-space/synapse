import { app } from 'electron';
import type { AppSettings, LanguageCode } from '../../src/types/chat';
import { getDb, persistDatabase, syncBuiltinSkillsLocale } from './core';

function detectDefaultLanguage(): LanguageCode {
  try {
    const sysLocale = (app.getLocale() || '').toLowerCase();
    if (sysLocale.startsWith('en')) {
      return 'en';
    }
  } catch {
    // Fallback to Russian if called before app ready
  }
  return 'ru';
}

export const DEFAULT_SETTINGS: AppSettings = {
  ollamaHost: 'http://127.0.0.1:11434',
  ollamaApiKey: '',
  theme: 'system',
  language: 'ru',
  defaultModel: '',
  enableNotifications: true,
  onboardingCompleted: false,
  compressionThresholdRatio: 0.72,
  keepRecentMessages: 6,
  customSystemPromptAddon: '',
  enableWebTools: true,
};

export function getSettings(): AppSettings {
  const defaultsWithLocale: AppSettings = {
    ...DEFAULT_SETTINGS,
    language: detectDefaultLanguage(),
  };
  const db = getDb();
  if (!db) return defaultsWithLocale;
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  stmt.bind(['app_settings']);
  if (stmt.step()) {
    const row = stmt.getAsObject() as { value: string };
    stmt.free();
    try {
      return { ...defaultsWithLocale, ...JSON.parse(row.value) };
    } catch {
      return defaultsWithLocale;
    }
  }
  stmt.free();
  return defaultsWithLocale;
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  const previous = getSettings();
  const merged = { ...previous, ...partial };
  const db = getDb();
  if (!db) return merged;
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
    'app_settings',
    JSON.stringify(merged),
  ]);
  if (partial.language && partial.language !== previous.language) {
    syncBuiltinSkillsLocale(partial.language);
  }
  persistDatabase();
  return merged;
}
