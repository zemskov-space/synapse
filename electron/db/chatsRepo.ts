import type { ChatRecord, MessageRecord } from '../../src/types/chat';
import { getDb, persistDatabase } from './core';

function mapRowToChat(row: Record<string, unknown>): ChatRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    model: String(row.model),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    compressedSummary: String(row.compressed_summary || ''),
    compressedUpToId: row.compressed_up_to_id ? String(row.compressed_up_to_id) : null,
    contextLimit: Number(row.context_limit || 8192),
    incognito: false,
    parentChatId: row.parent_chat_id ? String(row.parent_chat_id) : null,
    parentChatTitle: row.parent_chat_title ? String(row.parent_chat_title) : null,
  };
}

export function listChats(searchQuery = ''): ChatRecord[] {
  const db = getDb();
  if (!db) return [];
  const trimmed = searchQuery.trim().toLowerCase();

  let sql = `
    SELECT DISTINCT c.*
    FROM chats c
    LEFT JOIN messages m ON m.chat_id = c.id
  `;
  const params: string[] = [];

  if (trimmed) {
    sql += ` WHERE LOWER(c.title) LIKE ? OR LOWER(m.content) LIKE ? `;
    const pattern = `%${trimmed}%`;
    params.push(pattern, pattern);
  }

  sql += ` ORDER BY c.updated_at DESC`;

  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }

  const results: ChatRecord[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    results.push(mapRowToChat(row));
  }
  stmt.free();
  return results;
}

export function getChatById(chatId: string): ChatRecord | null {
  const db = getDb();
  if (!db) return null;
  const stmt = db.prepare('SELECT * FROM chats WHERE id = ?');
  stmt.bind([chatId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  return mapRowToChat(row);
}

export function createChatInDb(chat: ChatRecord): ChatRecord {
  const db = getDb();
  if (!db) return chat;
  db.run(
    `INSERT INTO chats (id, title, model, created_at, updated_at, compressed_summary, compressed_up_to_id, context_limit, parent_chat_id, parent_chat_title)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chat.id,
      chat.title,
      chat.model,
      chat.createdAt,
      chat.updatedAt,
      chat.compressedSummary || '',
      chat.compressedUpToId || null,
      chat.contextLimit || 8192,
      chat.parentChatId || null,
      chat.parentChatTitle || null,
    ]
  );
  persistDatabase();
  return chat;
}

export function updateChatInDb(
  chatId: string,
  updates: Partial<
    Pick<
      ChatRecord,
      'title' | 'model' | 'updatedAt' | 'compressedSummary' | 'compressedUpToId' | 'contextLimit'
    >
  >
): ChatRecord | null {
  const db = getDb();
  if (!db) return null;
  const existing = getChatById(chatId);
  if (!existing) return null;

  const updated: ChatRecord = {
    ...existing,
    ...updates,
    updatedAt: updates.updatedAt || new Date().toISOString(),
  };

  db.run(
    `UPDATE chats
     SET title = ?, model = ?, updated_at = ?, compressed_summary = ?, compressed_up_to_id = ?, context_limit = ?
     WHERE id = ?`,
    [
      updated.title,
      updated.model,
      updated.updatedAt,
      updated.compressedSummary,
      updated.compressedUpToId,
      updated.contextLimit,
      chatId,
    ]
  );
  persistDatabase();
  return updated;
}

export function deleteChatFromDb(chatId: string): void {
  const db = getDb();
  if (!db) return;
  db.run('DELETE FROM messages WHERE chat_id = ?', [chatId]);
  db.run('DELETE FROM chats WHERE id = ?', [chatId]);
  persistDatabase();
}

export function getMessagesByChatId(chatId: string): MessageRecord[] {
  const db = getDb();
  if (!db) return [];
  const stmt = db.prepare('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC');
  stmt.bind([chatId]);
  const messages: MessageRecord[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    let images: string[] = [];
    let toolCalls = undefined;
    let stats = undefined;
    try {
      images = JSON.parse(String(row.images_json || '[]'));
    } catch {
      images = [];
    }
    try {
      const parsedTools = JSON.parse(String(row.tool_calls_json || '[]'));
      if (Array.isArray(parsedTools) && parsedTools.length > 0) {
        toolCalls = parsedTools;
      }
    } catch {
      toolCalls = undefined;
    }
    try {
      if (row.stats_json) {
        const parsedStats = JSON.parse(String(row.stats_json));
        if (parsedStats && typeof parsedStats.tokensPerSec === 'number') {
          stats = parsedStats;
        }
      }
    } catch {
      stats = undefined;
    }
    messages.push({
      id: String(row.id),
      chatId: String(row.chat_id),
      role: String(row.role) as 'user' | 'assistant' | 'system',
      content: String(row.content),
      thinking: row.thinking ? String(row.thinking) : undefined,
      toolCalls,
      stats,
      images: images.length > 0 ? images : undefined,
      timestamp: String(row.timestamp),
      formattedTime: String(row.formatted_time),
      isCompressed: Boolean(Number(row.is_compressed || 0)),
    });
  }
  stmt.free();
  return messages;
}

export function saveMessageInDb(msg: MessageRecord): void {
  const db = getDb();
  if (!db) return;
  db.run(
    `INSERT OR REPLACE INTO messages
     (id, chat_id, role, content, thinking, tool_calls_json, stats_json, images_json, timestamp, formatted_time, is_compressed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msg.id,
      msg.chatId,
      msg.role,
      msg.content,
      msg.thinking || '',
      JSON.stringify(msg.toolCalls || []),
      msg.stats ? JSON.stringify(msg.stats) : '',
      JSON.stringify(msg.images || []),
      msg.timestamp,
      msg.formattedTime,
      msg.isCompressed ? 1 : 0,
    ]
  );
  db.run('UPDATE chats SET updated_at = ? WHERE id = ?', [msg.timestamp, msg.chatId]);
  persistDatabase();
}

/**
 * Rewinds a chat to a specific message ID: deletes that message and all messages after it.
 * If compressed messages were affected, resets the compressed summary so context stays consistent.
 */
export function truncateMessagesFromIdInDb(chatId: string, fromMessageId: string): void {
  const db = getDb();
  if (!db) return;
  const all = getMessagesByChatId(chatId);
  const targetIdx = all.findIndex((m) => m.id === fromMessageId);
  if (targetIdx === -1) return;

  const toDelete = all.slice(targetIdx);
  const remaining = all.slice(0, targetIdx);

  for (const m of toDelete) {
    db.run('DELETE FROM messages WHERE id = ? AND chat_id = ?', [m.id, chatId]);
  }

  // If no compressed messages remain or we rewound past the compression boundary, clear summary
  const anyCompressedLeft = remaining.some((m) => m.isCompressed);
  if (!anyCompressedLeft) {
    db.run(
      'UPDATE chats SET compressed_summary = ?, compressed_up_to_id = NULL WHERE id = ?',
      ['', chatId]
    );
  }

  persistDatabase();
}

export function markMessagesCompressedInDb(
  chatId: string,
  messageIds: string[],
  summary: string,
  upToId: string
): void {
  const db = getDb();
  if (!db || messageIds.length === 0) return;
  for (const id of messageIds) {
    db.run('UPDATE messages SET is_compressed = 1 WHERE id = ? AND chat_id = ?', [id, chatId]);
  }
  db.run('UPDATE chats SET compressed_summary = ?, compressed_up_to_id = ? WHERE id = ?', [
    summary,
    upToId,
    chatId,
  ]);
  persistDatabase();
}
