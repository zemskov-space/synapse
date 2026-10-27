import crypto from 'node:crypto';
import type { ChatRecord, MessageRecord } from '../../src/types/chat';
import {
  listChats,
  getChatById,
  createChatInDb,
  updateChatInDb,
  deleteChatFromDb,
  getMessagesByChatId,
  saveMessageInDb,
  markMessagesCompressedInDb,
  truncateMessagesFromIdInDb,
  getSettings,
} from '../db';
import { fetchModelContextLength } from './ollamaService';

/**
 * Pure RAM storage for Incognito Chats & Messages.
 * Never written to disk and cleared completely when the app closes or chat is deleted.
 */
const incognitoChats = new Map<string, ChatRecord>();
const incognitoMessages = new Map<string, MessageRecord[]>();

export function clearIncognitoStore(): void {
  incognitoChats.clear();
  incognitoMessages.clear();
}

export function getIncognitoDiagnostics(): {
  incognitoChatsCount: number;
  incognitoMessagesCount: number;
  incognitoChats: Array<{
    id: string;
    title: string;
    model: string;
    messageCount: number;
    updatedAt: string;
  }>;
} {
  let totalMsgs = 0;
  const chatsList: Array<{
    id: string;
    title: string;
    model: string;
    messageCount: number;
    updatedAt: string;
  }> = [];

  for (const chat of incognitoChats.values()) {
    const msgs = incognitoMessages.get(chat.id) || [];
    totalMsgs += msgs.length;
    chatsList.push({
      id: chat.id,
      title: chat.title,
      model: chat.model,
      messageCount: msgs.length,
      updatedAt: chat.updatedAt,
    });
  }

  return {
    incognitoChatsCount: incognitoChats.size,
    incognitoMessagesCount: totalMsgs,
    incognitoChats: chatsList,
  };
}

export function getUnifiedChat(chatId: string): ChatRecord | null {
  if (incognitoChats.has(chatId)) {
    return incognitoChats.get(chatId)!;
  }
  return getChatById(chatId);
}

export function getUnifiedMessages(chatId: string): MessageRecord[] {
  if (incognitoChats.has(chatId)) {
    return incognitoMessages.get(chatId) || [];
  }
  return getMessagesByChatId(chatId);
}

export function saveUnifiedMessage(chat: ChatRecord, msg: MessageRecord): void {
  if (chat.incognito) {
    const list = incognitoMessages.get(chat.id) || [];
    const existingIdx = list.findIndex((m) => m.id === msg.id);
    if (existingIdx >= 0) {
      list[existingIdx] = msg;
    } else {
      list.push(msg);
    }
    incognitoMessages.set(chat.id, list);
    chat.updatedAt = msg.timestamp;
    incognitoChats.set(chat.id, { ...chat });
  } else {
    saveMessageInDb(msg);
  }
}

export function updateUnifiedChat(
  chatId: string,
  updates: Partial<
    Pick<
      ChatRecord,
      'title' | 'model' | 'updatedAt' | 'compressedSummary' | 'compressedUpToId' | 'contextLimit'
    >
  >
): ChatRecord | null {
  if (incognitoChats.has(chatId)) {
    const existing = incognitoChats.get(chatId)!;
    const updated: ChatRecord = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString(),
    };
    incognitoChats.set(chatId, updated);
    return updated;
  }
  return updateChatInDb(chatId, updates);
}

export function markUnifiedMessagesCompressed(
  chat: ChatRecord,
  messageIds: string[],
  summary: string,
  upToId: string
): void {
  if (chat.incognito) {
    const list = incognitoMessages.get(chat.id) || [];
    const idSet = new Set(messageIds);
    for (const m of list) {
      if (idSet.has(m.id)) {
        m.isCompressed = true;
      }
    }
    incognitoMessages.set(chat.id, list);
    chat.compressedSummary = summary;
    chat.compressedUpToId = upToId;
    incognitoChats.set(chat.id, { ...chat });
  } else {
    markMessagesCompressedInDb(chat.id, messageIds, summary, upToId);
  }
}

export function truncateUnifiedMessagesFromId(
  chat: ChatRecord,
  fromMessageId: string
): ChatRecord {
  if (chat.incognito) {
    const list = incognitoMessages.get(chat.id) || [];
    const idx = list.findIndex((m) => m.id === fromMessageId);
    if (idx !== -1) {
      const remaining = list.slice(0, idx);
      incognitoMessages.set(chat.id, remaining);
      if (!remaining.some((m) => m.isCompressed)) {
        chat.compressedSummary = '';
        chat.compressedUpToId = null;
        incognitoChats.set(chat.id, { ...chat });
      }
    }
    return incognitoChats.get(chat.id) || chat;
  } else {
    truncateMessagesFromIdInDb(chat.id, fromMessageId);
    return getChatById(chat.id) || chat;
  }
}

export function listUnifiedChats(searchQuery = ''): ChatRecord[] {
  const persistent = listChats(searchQuery);
  const trimmed = searchQuery.trim().toLowerCase();

  const ramList: ChatRecord[] = [];
  for (const chat of incognitoChats.values()) {
    if (!trimmed) {
      ramList.push(chat);
    } else {
      const msgs = incognitoMessages.get(chat.id) || [];
      const matchesTitle = chat.title.toLowerCase().includes(trimmed);
      const matchesMsg = msgs.some((m) => m.content.toLowerCase().includes(trimmed));
      if (matchesTitle || matchesMsg) {
        ramList.push(chat);
      }
    }
  }

  return [...ramList, ...persistent].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function createUnifiedChat(payload: {
  model: string;
  incognito?: boolean;
  title?: string;
}): Promise<ChatRecord> {
  const now = new Date().toISOString();
  const settings = getSettings();
  const isEn = settings.language === 'en';
  const contextLimit = await fetchModelContextLength(
    settings.ollamaHost,
    payload.model,
    settings.ollamaApiKey
  );

  const defaultTitle = payload.incognito
    ? isEn
      ? 'Incognito Chat'
      : 'Инкогнито чат'
    : isEn
      ? 'New Chat'
      : 'Новый диалог';

  const newChat: ChatRecord = {
    id: crypto.randomUUID(),
    title: payload.title || defaultTitle,
    model: payload.model || '',
    createdAt: now,
    updatedAt: now,
    compressedSummary: '',
    compressedUpToId: null,
    contextLimit,
    incognito: Boolean(payload.incognito),
  };

  if (newChat.incognito) {
    incognitoChats.set(newChat.id, newChat);
    incognitoMessages.set(newChat.id, []);
    return newChat;
  }

  return createChatInDb(newChat);
}

export function deleteUnifiedChat(chatId: string): void {
  if (incognitoChats.has(chatId)) {
    incognitoChats.delete(chatId);
    incognitoMessages.delete(chatId);
    return;
  }
  deleteChatFromDb(chatId);
}

export function duplicateUnifiedChat(sourceChatId: string): ChatRecord {
  const settings = getSettings();
  const isEn = settings.language === 'en';
  const sourceChat = getUnifiedChat(sourceChatId);
  if (!sourceChat) {
    throw new Error(isEn ? 'Source chat not found' : 'Исходный чат не найден');
  }
  const sourceMessages = getUnifiedMessages(sourceChatId);
  const now = new Date().toISOString();
  const newChatId = crypto.randomUUID();

  // Map old message IDs to new cloned message IDs so compressedUpToId stays consistent
  const idMap = new Map<string, string>();
  const clonedMessages: MessageRecord[] = sourceMessages.map((m) => {
    const newMsgId = crypto.randomUUID();
    idMap.set(m.id, newMsgId);
    return {
      ...m,
      id: newMsgId,
      chatId: newChatId,
      images: m.images ? [...m.images] : undefined,
      toolCalls: m.toolCalls ? m.toolCalls.map((tc) => ({ ...tc })) : undefined,
      stats: m.stats ? { ...m.stats } : undefined,
    };
  });

  const newCompressedUpToId =
    sourceChat.compressedUpToId && idMap.has(sourceChat.compressedUpToId)
      ? idMap.get(sourceChat.compressedUpToId)!
      : null;

  const copySuffix = isEn ? '(copy)' : '(копия)';
  const duplicatedChat: ChatRecord = {
    id: newChatId,
    title: `${sourceChat.title} ${copySuffix}`,
    model: sourceChat.model,
    createdAt: now,
    updatedAt: now,
    compressedSummary: sourceChat.compressedSummary || '',
    compressedUpToId: newCompressedUpToId,
    contextLimit: sourceChat.contextLimit || 8192,
    incognito: Boolean(sourceChat.incognito),
    parentChatId: sourceChat.id,
    parentChatTitle: sourceChat.title,
  };

  if (duplicatedChat.incognito) {
    incognitoChats.set(duplicatedChat.id, duplicatedChat);
    incognitoMessages.set(duplicatedChat.id, clonedMessages);
    return duplicatedChat;
  }

  createChatInDb(duplicatedChat);
  for (const msg of clonedMessages) {
    saveMessageInDb(msg);
  }
  return duplicatedChat;
}
