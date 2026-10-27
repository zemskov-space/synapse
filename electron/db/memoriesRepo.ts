import crypto from 'node:crypto';
import type { UserMemoryItem } from '../../src/types/chat';
import { getDb, persistDatabase } from './core';

export function listUserMemories(): UserMemoryItem[] {
  const db = getDb();
  if (!db) return [];
  const stmt = db.prepare('SELECT * FROM user_memories ORDER BY created_at DESC');
  const items: UserMemoryItem[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    items.push({
      id: String(row.id),
      content: String(row.content),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    });
  }
  stmt.free();
  return items;
}

export function addUserMemory(content: string): UserMemoryItem | null {
  const db = getDb();
  if (!db) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;

  // Check if an identical memory (case-insensitive) already exists
  const existing = listUserMemories().find(
    (m) => m.content.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const item: UserMemoryItem = {
    id: crypto.randomUUID(),
    content: trimmed,
    createdAt: now,
    updatedAt: now,
  };
  db.run(
    'INSERT INTO user_memories (id, content, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [item.id, item.content, item.createdAt, item.updatedAt]
  );
  persistDatabase();
  return item;
}

export function updateUserMemory(id: string, content: string): UserMemoryItem | null {
  const db = getDb();
  if (!db) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  const now = new Date().toISOString();
  db.run('UPDATE user_memories SET content = ?, updated_at = ? WHERE id = ?', [
    trimmed,
    now,
    id,
  ]);
  persistDatabase();
  const all = listUserMemories();
  return all.find((m) => m.id === id) || null;
}

export function deleteUserMemory(id: string): void {
  const db = getDb();
  if (!db) return;
  db.run('DELETE FROM user_memories WHERE id = ?', [id]);
  persistDatabase();
}

export function clearAllUserMemories(): void {
  const db = getDb();
  if (!db) return;
  db.run('DELETE FROM user_memories');
  persistDatabase();
}
