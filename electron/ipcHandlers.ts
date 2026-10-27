import { BrowserWindow, ipcMain, nativeTheme, shell } from 'electron';
import type {
  AiProviderConfig,
  AppSettings,
  DevDiagnosticsInfo,
  McpServerConfig,
  SkillRecord,
} from '../src/types/chat';
import {
  getSettings,
  saveSettings,
  listUserMemories,
  addUserMemory,
  updateUserMemory,
  deleteUserMemory,
  clearAllUserMemories,
  saveMcpServer,
  deleteMcpServer,
  listSkills,
  saveSkill,
  deleteSkill,
  listAiProviders,
  saveAiProvider,
  deleteAiProvider,
  getDbFilePath,
  getDatabaseFileStats,
  listDbTables,
  getTableRows,
  updateTableRow,
  insertTableRow,
  deleteTableRow,
  executeRawSql,
  vacuumDatabase,
} from './db';
import {
  syncAllMcpServers,
  reconnectMcpServer,
  getMcpServersStatus,
} from './mcp';
import {
  clearOllamaCaches,
  fetchModelContextLength,
  getOllamaCachesDiagnostics,
  listOllamaModels,
  listRunningOllamaModels,
  toggleLoadOllamaModel,
} from './services/ollamaService';
import { fetchOpenAiProviderModels } from './services/openaiService';
import {
  clearIncognitoStore,
  createUnifiedChat,
  deleteUnifiedChat,
  duplicateUnifiedChat,
  getIncognitoDiagnostics,
  getUnifiedChat,
  getUnifiedMessages,
  listUnifiedChats,
  updateUnifiedChat,
} from './services/chatStore';
import {
  sendChatMessageAndStream,
  stopChatGeneration,
  type SendMessagePayload,
} from './services/chatOrchestrator';

export function registerIpcHandlers(): void {
  // App Settings
  ipcMain.handle('settings:get', () => ({
    ...getSettings(),
    systemDark: nativeTheme.shouldUseDarkColors,
  }));

  ipcMain.handle('settings:save', (_event, partial: Partial<AppSettings>) => {
    const updated = saveSettings(partial);
    return {
      ...updated,
      systemDark: nativeTheme.shouldUseDarkColors,
    };
  });

  // Global User Memories
  ipcMain.handle('memories:list', () => listUserMemories());

  ipcMain.handle('memories:add', (_event, content: string) => {
    addUserMemory(content);
    return listUserMemories();
  });

  ipcMain.handle('memories:update', (_event, payload: { id: string; content: string }) => {
    updateUserMemory(payload.id, payload.content);
    return listUserMemories();
  });

  ipcMain.handle('memories:delete', (_event, id: string) => {
    deleteUserMemory(id);
    return listUserMemories();
  });

  ipcMain.handle('memories:clear', () => {
    clearAllUserMemories();
    return [];
  });

  // MCP Servers
  ipcMain.handle('mcp:list', () => getMcpServersStatus());

  ipcMain.handle(
    'mcp:save',
    async (_event, server: Omit<McpServerConfig, 'id' | 'createdAt'> & { id?: string }) => {
      saveMcpServer(server);
      return await syncAllMcpServers();
    }
  );

  ipcMain.handle('mcp:delete', async (_event, id: string) => {
    deleteMcpServer(id);
    return await syncAllMcpServers();
  });

  ipcMain.handle('mcp:reconnect', async (_event, id: string) => {
    return await reconnectMcpServer(id);
  });

  // Skills
  ipcMain.handle('skills:list', () => listSkills());

  ipcMain.handle(
    'skills:save',
    (_event, skill: Omit<SkillRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
      saveSkill(skill);
      return listSkills();
    }
  );

  ipcMain.handle('skills:delete', (_event, id: string) => {
    deleteSkill(id);
    return listSkills();
  });

  // External OpenAI-Compatible AI Providers
  ipcMain.handle('providers:list', () => listAiProviders());

  ipcMain.handle(
    'providers:save',
    (_event, provider: Omit<AiProviderConfig, 'id' | 'createdAt'> & { id?: string }) => {
      saveAiProvider(provider);
      return listAiProviders();
    }
  );

  ipcMain.handle('providers:delete', (_event, id: string) => {
    deleteAiProvider(id);
    return listAiProviders();
  });

  ipcMain.handle(
    'providers:fetch-models',
    async (_event, payload: { baseUrl: string; apiKey?: string }) => {
      return fetchOpenAiProviderModels(payload.baseUrl, payload.apiKey);
    }
  );

  // Ollama Models & Memory Status
  ipcMain.handle(
    'ollama:list-models',
    async (_event, customConn?: { host?: string; apiKey?: string }) => {
      const settings = getSettings();
      const host = customConn?.host?.trim() || settings.ollamaHost;
      const apiKey =
        customConn?.apiKey !== undefined ? customConn.apiKey : settings.ollamaApiKey;
      return listOllamaModels(host, apiKey);
    }
  );

  ipcMain.handle('ollama:running-models', async () => {
    const settings = getSettings();
    return listRunningOllamaModels(settings.ollamaHost, settings.ollamaApiKey);
  });

  ipcMain.handle('ollama:model-context', async (_event, modelName: string) => {
    const settings = getSettings();
    return fetchModelContextLength(settings.ollamaHost, modelName, settings.ollamaApiKey);
  });

  ipcMain.handle('ollama:toggle-load-model', async (_event, modelName: string, load: boolean) => {
    const settings = getSettings();
    return toggleLoadOllamaModel(settings.ollamaHost, modelName, load, settings.ollamaApiKey);
  });

  // Chats CRUD
  ipcMain.handle('chats:list', (_event, searchQuery = '') => listUnifiedChats(searchQuery));

  ipcMain.handle(
    'chats:create',
    async (_event, payload: { model: string; incognito?: boolean; title?: string }) => {
      return createUnifiedChat(payload);
    }
  );

  ipcMain.handle(
    'chats:update',
    (_event, payload: { chatId: string; title?: string; model?: string }) => {
      return updateUnifiedChat(payload.chatId, {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.model !== undefined ? { model: payload.model } : {}),
      });
    }
  );

  ipcMain.handle('chats:delete', (_event, chatId: string) => {
    stopChatGeneration(chatId);
    deleteUnifiedChat(chatId);
    return { ok: true };
  });

  ipcMain.handle('chats:get-messages', (_event, chatId: string) => {
    const chat = getUnifiedChat(chatId);
    const messages = getUnifiedMessages(chatId);
    return { chat, messages };
  });

  ipcMain.handle('chats:duplicate', (_event, sourceChatId: string) => {
    return duplicateUnifiedChat(sourceChatId);
  });

  // Generation & Streaming
  ipcMain.handle('chat:stop-generation', (_event, chatId: string) => {
    stopChatGeneration(chatId);
    return { ok: true };
  });

  ipcMain.handle('chat:send-message', async (event, payload: SendMessagePayload) => {
    return sendChatMessageAndStream(event.sender, payload);
  });

  // External Links
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url.trim())) {
      await shell.openExternal(url.trim());
      return { ok: true };
    }
    return { ok: false };
  });

  // Developer Menu & Database Inspector IPC
  ipcMain.handle('dev:list-tables', () => listDbTables());

  ipcMain.handle(
    'dev:get-table-rows',
    (
      _event,
      payload: { tableName: string; limit?: number; offset?: number; search?: string }
    ) => getTableRows(payload)
  );

  ipcMain.handle(
    'dev:update-row',
    (
      _event,
      payload: {
        tableName: string;
        pkColumn: string;
        pkValue: string | number;
        updates: Record<string, unknown>;
      }
    ) => updateTableRow(payload)
  );

  ipcMain.handle(
    'dev:insert-row',
    (_event, payload: { tableName: string; values: Record<string, unknown> }) =>
      insertTableRow(payload)
  );

  ipcMain.handle(
    'dev:delete-row',
    (
      _event,
      payload: { tableName: string; pkColumn: string; pkValue: string | number }
    ) => deleteTableRow(payload)
  );

  ipcMain.handle('dev:execute-sql', (_event, sqlQuery: string) => executeRawSql(sqlQuery));

  ipcMain.handle('dev:vacuum-db', () => vacuumDatabase());

  ipcMain.handle('dev:get-diagnostics', (): DevDiagnosticsInfo => {
    const dbStats = getDatabaseFileStats();
    const incognitoStats = getIncognitoDiagnostics();
    const ollamaCaches = getOllamaCachesDiagnostics();

    return {
      dbFilePath: dbStats.filePath,
      dbFileSizeBytes: dbStats.sizeBytes,
      tableCount: dbStats.tableCount,
      incognitoChatsCount: incognitoStats.incognitoChatsCount,
      incognitoMessagesCount: incognitoStats.incognitoMessagesCount,
      incognitoChats: incognitoStats.incognitoChats,
      modelContextCache: ollamaCaches.modelContextCache,
      disabledToolsModels: ollamaCaches.disabledToolsModels,
      versions: {
        electron: process.versions.electron || '',
        chrome: process.versions.chrome || '',
        node: process.versions.node || '',
        platform: process.platform,
        arch: process.arch,
      },
    };
  });

  ipcMain.handle('dev:clear-caches', () => {
    clearOllamaCaches();
    return { ok: true };
  });

  ipcMain.handle('dev:clear-incognito', () => {
    clearIncognitoStore();
    return { ok: true };
  });

  ipcMain.handle('dev:show-db-in-folder', () => {
    const dbPath = getDbFilePath();
    if (dbPath) {
      shell.showItemInFolder(dbPath);
      return { ok: true };
    }
    return { ok: false };
  });

  ipcMain.handle('dev:toggle-devtools', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.webContents.toggleDevTools();
    return { ok: true };
  });
}
