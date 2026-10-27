import crypto from 'node:crypto';
import type { AiProviderConfig, McpServerConfig, SkillRecord } from '../../src/types/chat';
import { getDb, persistDatabase } from './core';

// MCP Servers CRUD
export function listMcpServers(): McpServerConfig[] {
  const db = getDb();
  if (!db) return [];
  const stmt = db.prepare('SELECT * FROM mcp_servers ORDER BY created_at ASC');
  const items: McpServerConfig[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    let args: string[] = [];
    let env: Record<string, string> = {};
    try {
      args = JSON.parse(String(row.args_json || '[]'));
    } catch {
      args = [];
    }
    try {
      env = JSON.parse(String(row.env_json || '{}'));
    } catch {
      env = {};
    }
    items.push({
      id: String(row.id),
      name: String(row.name),
      transport: (String(row.transport) === 'http' ? 'http' : 'stdio') as 'stdio' | 'http',
      command: row.command ? String(row.command) : undefined,
      args,
      env,
      url: row.url ? String(row.url) : undefined,
      enabled: Boolean(Number(row.enabled ?? 1)),
      createdAt: String(row.created_at),
    });
  }
  stmt.free();
  return items;
}

export function saveMcpServer(
  server: Omit<McpServerConfig, 'id' | 'createdAt'> & { id?: string }
): McpServerConfig {
  const db = getDb();
  const now = new Date().toISOString();
  const id = server.id || crypto.randomUUID();
  const record: McpServerConfig = {
    id,
    name: server.name.trim() || 'MCP Server',
    transport: server.transport,
    command: server.command?.trim() || '',
    args: server.args || [],
    env: server.env || {},
    url: server.url?.trim() || '',
    enabled: server.enabled ?? true,
    createdAt: now,
  };
  if (db) {
    db.run(
      `INSERT OR REPLACE INTO mcp_servers
       (id, name, transport, command, args_json, env_json, url, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.name,
        record.transport,
        record.command || '',
        JSON.stringify(record.args || []),
        JSON.stringify(record.env || {}),
        record.url || '',
        record.enabled ? 1 : 0,
        record.createdAt,
      ]
    );
    persistDatabase();
  }
  return record;
}

export function deleteMcpServer(id: string): void {
  const db = getDb();
  if (!db) return;
  db.run('DELETE FROM mcp_servers WHERE id = ?', [id]);
  persistDatabase();
}

// Skills CRUD
export function listSkills(): SkillRecord[] {
  const db = getDb();
  if (!db) return [];
  const stmt = db.prepare('SELECT * FROM skills ORDER BY is_builtin DESC, slug ASC');
  const items: SkillRecord[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    items.push({
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      description: String(row.description),
      instructions: String(row.instructions),
      enabled: Boolean(Number(row.enabled ?? 1)),
      builtin: Boolean(Number(row.is_builtin ?? 0)),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    });
  }
  stmt.free();
  return items;
}

export function saveSkill(
  payload: Omit<SkillRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): SkillRecord {
  const db = getDb();
  const now = new Date().toISOString();
  const id = payload.id || crypto.randomUUID();
  const cleanSlug = payload.slug
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9а-яё_-]/gi, '-')
    .replace(/-+/g, '-');

  const record: SkillRecord = {
    id,
    slug: cleanSlug || `skill-${Date.now()}`,
    name: payload.name.trim() || 'Новый скилл',
    description: payload.description.trim() || '',
    instructions: payload.instructions.trim() || '',
    enabled: payload.enabled ?? true,
    builtin: Boolean(payload.builtin),
    createdAt: now,
    updatedAt: now,
  };

  if (db) {
    db.run(
      `INSERT OR REPLACE INTO skills
       (id, slug, name, description, instructions, enabled, is_builtin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.slug,
        record.name,
        record.description,
        record.instructions,
        record.enabled ? 1 : 0,
        record.builtin ? 1 : 0,
        record.createdAt,
        record.updatedAt,
      ]
    );
    persistDatabase();
  }
  return record;
}

export function deleteSkill(id: string): void {
  const db = getDb();
  if (!db) return;
  db.run('DELETE FROM skills WHERE id = ?', [id]);
  persistDatabase();
}

// External OpenAI-Compatible AI Providers CRUD
export function listAiProviders(): AiProviderConfig[] {
  const db = getDb();
  if (!db) return [];
  const stmt = db.prepare('SELECT * FROM ai_providers ORDER BY created_at ASC');
  const items: AiProviderConfig[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    let models: string[] = [];
    try {
      models = JSON.parse(String(row.models_json || '[]'));
    } catch {
      models = [];
    }
    items.push({
      id: String(row.id),
      name: String(row.name),
      baseUrl: String(row.base_url),
      apiKey: String(row.api_key || ''),
      models: Array.isArray(models) ? models.map(String) : [],
      enabled: Boolean(Number(row.enabled ?? 1)),
      createdAt: String(row.created_at),
    });
  }
  stmt.free();
  return items;
}

export function saveAiProvider(
  payload: Omit<AiProviderConfig, 'id' | 'createdAt'> & { id?: string }
): AiProviderConfig {
  const db = getDb();
  const now = new Date().toISOString();
  const id = payload.id || crypto.randomUUID();
  const cleanModels = Array.from(
    new Set((payload.models || []).map((m) => m.trim()).filter(Boolean))
  );
  const record: AiProviderConfig = {
    id,
    name: payload.name.trim() || 'OpenAI Provider',
    baseUrl: payload.baseUrl.trim().replace(/\/+$/, ''),
    apiKey: payload.apiKey?.trim() || '',
    models: cleanModels,
    enabled: payload.enabled ?? true,
    createdAt: now,
  };

  if (db) {
    db.run(
      `INSERT OR REPLACE INTO ai_providers
       (id, name, base_url, api_key, models_json, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.name,
        record.baseUrl,
        record.apiKey,
        JSON.stringify(record.models),
        record.enabled ? 1 : 0,
        record.createdAt,
      ]
    );
    persistDatabase();
  }
  return record;
}

export function deleteAiProvider(id: string): void {
  const db = getDb();
  if (!db) return;
  db.run('DELETE FROM ai_providers WHERE id = ?', [id]);
  persistDatabase();
}
