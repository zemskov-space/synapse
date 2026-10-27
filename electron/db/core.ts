import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import type { LanguageCode, SkillRecord } from '../../src/types/chat';
import { getTranslationDictionary } from '../../src/i18n';

let db: SqlJsDatabase | null = null;
let dbFilePath = '';

export function getDb(): SqlJsDatabase | null {
  return db;
}

export function getDbFilePath(): string {
  return dbFilePath;
}

function resolveWasmPath(): string {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.join(
      process.resourcesPath || '',
      'app.asar.unpacked',
      'node_modules',
      'sql.js',
      'dist',
      'sql-wasm.wasm'
    ),
    path.join(process.resourcesPath || '', 'sql-wasm.wasm'),
    path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

function getInitialLanguageFromDb(): LanguageCode {
  if (!db) return 'ru';
  try {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    stmt.bind(['app_settings']);
    if (stmt.step()) {
      const row = stmt.getAsObject() as { value?: string };
      stmt.free();
      if (row.value) {
        const parsed = JSON.parse(row.value) as { language?: LanguageCode };
        if (parsed.language === 'en' || parsed.language === 'ru') {
          return parsed.language;
        }
      }
    } else {
      stmt.free();
    }
  } catch {
    // ignore
  }
  try {
    const sysLocale = (app.getLocale() || '').toLowerCase();
    if (sysLocale.startsWith('en')) return 'en';
  } catch {
    // ignore
  }
  return 'ru';
}

export async function initDatabase(): Promise<void> {
  if (db) return;

  const userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  dbFilePath = path.join(userDataDir, 'synapse_local.sqlite');

  const SQL = await initSqlJs({
    locateFile: () => resolveWasmPath(),
  });

  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(new Uint8Array(fileBuffer));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      compressed_summary TEXT DEFAULT '',
      compressed_up_to_id TEXT DEFAULT NULL,
      context_limit INTEGER DEFAULT 8192,
      parent_chat_id TEXT DEFAULT NULL,
      parent_chat_title TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      thinking TEXT DEFAULT '',
      tool_calls_json TEXT DEFAULT '[]',
      stats_json TEXT DEFAULT '',
      images_json TEXT DEFAULT '[]',
      timestamp TEXT NOT NULL,
      formatted_time TEXT NOT NULL,
      is_compressed INTEGER DEFAULT 0,
      FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC);

    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      transport TEXT NOT NULL,
      command TEXT DEFAULT '',
      args_json TEXT DEFAULT '[]',
      env_json TEXT DEFAULT '{}',
      url TEXT DEFAULT '',
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      instructions TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      is_builtin INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT DEFAULT '',
      models_json TEXT DEFAULT '[]',
      enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);

  // Safe migrations for existing databases
  const migrations = [
    `ALTER TABLE messages ADD COLUMN tool_calls_json TEXT DEFAULT '[]'`,
    `ALTER TABLE messages ADD COLUMN stats_json TEXT DEFAULT ''`,
    `ALTER TABLE chats ADD COLUMN parent_chat_id TEXT DEFAULT NULL`,
    `ALTER TABLE chats ADD COLUMN parent_chat_title TEXT DEFAULT NULL`,
  ];
  for (const sql of migrations) {
    try {
      db.run(sql);
    } catch {
      // Column already exists
    }
  }

  const initialLang = getInitialLanguageFromDb();
  seedBuiltinSkillsIfEmpty(initialLang);
  syncBuiltinSkillsLocale(initialLang);
  persistDatabase();
}

function buildBuiltinSkillRecords(language: LanguageCode, timestamp: string): SkillRecord[] {
  const bs = getTranslationDictionary(language).builtinSkills;
  return [
    {
      id: 'skill-code-review',
      slug: 'review',
      name: bs.review.name,
      description: bs.review.description,
      instructions: bs.review.instructions,
      enabled: true,
      builtin: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'skill-interactive-ui',
      slug: 'ui',
      name: bs.ui.name,
      description: bs.ui.description,
      instructions: bs.ui.instructions,
      enabled: true,
      builtin: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'skill-web-research',
      slug: 'research',
      name: bs.research.name,
      description: bs.research.description,
      instructions: bs.research.instructions,
      enabled: true,
      builtin: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'skill-quiz-brief',
      slug: 'brief',
      name: bs.brief.name,
      description: bs.brief.description,
      instructions: bs.brief.instructions,
      enabled: true,
      builtin: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
}

function seedBuiltinSkillsIfEmpty(language: LanguageCode): void {
  if (!db) return;
  const stmt = db.prepare('SELECT COUNT(*) as cnt FROM skills');
  let count = 0;
  if (stmt.step()) {
    const row = stmt.getAsObject() as { cnt?: number };
    count = Number(row.cnt || 0);
  }
  stmt.free();
  if (count > 0) return;

  const now = new Date().toISOString();
  const defaults = buildBuiltinSkillRecords(language, now);

  for (const s of defaults) {
    db.run(
      `INSERT INTO skills (id, slug, name, description, instructions, enabled, is_builtin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.slug,
        s.name,
        s.description,
        s.instructions,
        s.enabled ? 1 : 0,
        s.builtin ? 1 : 0,
        s.createdAt,
        s.updatedAt,
      ]
    );
  }
}

/**
 * Updates unmodified built-in skills (`is_builtin = 1`) when the user switches the interface language.
 */
export function syncBuiltinSkillsLocale(targetLanguage: LanguageCode): void {
  if (!db) return;
  const now = new Date().toISOString();
  const targetSkills = buildBuiltinSkillRecords(targetLanguage, now);
  const otherLanguage: LanguageCode = targetLanguage === 'en' ? 'ru' : 'en';
  const otherSkills = buildBuiltinSkillRecords(otherLanguage, now);

  for (let i = 0; i < targetSkills.length; i++) {
    const target = targetSkills[i];
    const other = otherSkills[i];

    const stmt = db.prepare(
      'SELECT name, description, instructions FROM skills WHERE id = ? AND is_builtin = 1'
    );
    stmt.bind([target.id]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as {
        name?: string;
        description?: string;
        instructions?: string;
      };
      stmt.free();
      // Only overwrite if the skill has not been manually customized by the user
      const isDefaultOther =
        row.name === other.name && row.instructions === other.instructions;
      if (isDefaultOther) {
        db.run(
          `UPDATE skills SET name = ?, description = ?, instructions = ?, updated_at = ? WHERE id = ?`,
          [target.name, target.description, target.instructions, now, target.id]
        );
      }
    } else {
      stmt.free();
    }
  }
}

export function persistDatabase(): void {
  if (!db || !dbFilePath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbFilePath, buffer);
}
