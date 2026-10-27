import { contextBridge, ipcRenderer } from 'electron';
import type {
  AiProviderConfig,
  AppSettings,
  ChatRecord,
  MessageRecord,
  OllamaModelInfo,
  OllamaRunningModel,
  StreamChunkPayload,
  UserMemoryItem,
  McpServerConfig,
  McpServerStatus,
  SkillRecord,
  DbTableInfo,
  DbTableRowsResponse,
  SqlQueryExecutionResult,
  DevDiagnosticsInfo,
} from '../src/types/chat';

const electronApi = {
  getSettings: (): Promise<AppSettings & { systemDark: boolean }> =>
    ipcRenderer.invoke('settings:get'),
  saveSettings: (
    partial: Partial<AppSettings>
  ): Promise<AppSettings & { systemDark: boolean }> =>
    ipcRenderer.invoke('settings:save', partial),

  // Global User Memories
  listMemories: (): Promise<UserMemoryItem[]> =>
    ipcRenderer.invoke('memories:list'),
  addMemory: (content: string): Promise<UserMemoryItem[]> =>
    ipcRenderer.invoke('memories:add', content),
  updateMemory: (payload: { id: string; content: string }): Promise<UserMemoryItem[]> =>
    ipcRenderer.invoke('memories:update', payload),
  deleteMemory: (id: string): Promise<UserMemoryItem[]> =>
    ipcRenderer.invoke('memories:delete', id),
  clearMemories: (): Promise<UserMemoryItem[]> =>
    ipcRenderer.invoke('memories:clear'),

  // MCP Servers
  listMcpServers: (): Promise<McpServerStatus[]> =>
    ipcRenderer.invoke('mcp:list'),
  saveMcpServer: (
    server: Omit<McpServerConfig, 'id' | 'createdAt'> & { id?: string }
  ): Promise<McpServerStatus[]> => ipcRenderer.invoke('mcp:save', server),
  deleteMcpServer: (id: string): Promise<McpServerStatus[]> =>
    ipcRenderer.invoke('mcp:delete', id),
  reconnectMcpServer: (id: string): Promise<McpServerStatus[]> =>
    ipcRenderer.invoke('mcp:reconnect', id),

  // Skills
  listSkills: (): Promise<SkillRecord[]> =>
    ipcRenderer.invoke('skills:list'),
  saveSkill: (
    skill: Omit<SkillRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<SkillRecord[]> => ipcRenderer.invoke('skills:save', skill),
  deleteSkill: (id: string): Promise<SkillRecord[]> =>
    ipcRenderer.invoke('skills:delete', id),

  // External OpenAI-Compatible AI Providers
  listProviders: (): Promise<AiProviderConfig[]> =>
    ipcRenderer.invoke('providers:list'),
  saveProvider: (
    provider: Omit<AiProviderConfig, 'id' | 'createdAt'> & { id?: string }
  ): Promise<AiProviderConfig[]> => ipcRenderer.invoke('providers:save', provider),
  deleteProvider: (id: string): Promise<AiProviderConfig[]> =>
    ipcRenderer.invoke('providers:delete', id),
  fetchProviderModels: (payload: {
    baseUrl: string;
    apiKey?: string;
  }): Promise<{ ok: boolean; models: string[]; error?: string }> =>
    ipcRenderer.invoke('providers:fetch-models', payload),

  listModels: (customConn?: {
    host?: string;
    apiKey?: string;
  }): Promise<{ ok: boolean; models: OllamaModelInfo[]; error?: string }> =>
    ipcRenderer.invoke('ollama:list-models', customConn),
  getRunningModels: (): Promise<{ ok: boolean; models: OllamaRunningModel[]; error?: string }> =>
    ipcRenderer.invoke('ollama:running-models'),
  getModelContext: (modelName: string): Promise<number> =>
    ipcRenderer.invoke('ollama:model-context', modelName),
  toggleLoadModel: (modelName: string, load: boolean): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('ollama:toggle-load-model', modelName, load),

  listChats: (searchQuery = ''): Promise<ChatRecord[]> =>
    ipcRenderer.invoke('chats:list', searchQuery),
  createChat: (payload: {
    model: string;
    incognito?: boolean;
    title?: string;
  }): Promise<ChatRecord> => ipcRenderer.invoke('chats:create', payload),
  updateChat: (payload: {
    chatId: string;
    title?: string;
    model?: string;
  }): Promise<ChatRecord | null> => ipcRenderer.invoke('chats:update', payload),
  deleteChat: (chatId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('chats:delete', chatId),
  getChatMessages: (
    chatId: string
  ): Promise<{ chat: ChatRecord | null; messages: MessageRecord[] }> =>
    ipcRenderer.invoke('chats:get-messages', chatId),
  duplicateChat: (sourceChatId: string): Promise<ChatRecord> =>
    ipcRenderer.invoke('chats:duplicate', sourceChatId),

  sendMessage: (payload: {
    chatId: string;
    content: string;
    images?: string[];
    model?: string;
    rewindToMessageId?: string;
    activeSkillIds?: string[];
  }): Promise<{
    ok: boolean;
    aborted?: boolean;
    error?: string;
    userMessage: MessageRecord;
    assistantMessage: MessageRecord;
    chat: ChatRecord | null;
  }> => ipcRenderer.invoke('chat:send-message', payload),

  stopGeneration: (chatId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('chat:stop-generation', chatId),

  openExternalUrl: (url: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('shell:open-external', url),

  // Developer Menu & Database Inspector
  devListTables: (): Promise<DbTableInfo[]> => ipcRenderer.invoke('dev:list-tables'),
  devGetTableRows: (payload: {
    tableName: string;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<DbTableRowsResponse> => ipcRenderer.invoke('dev:get-table-rows', payload),
  devUpdateRow: (payload: {
    tableName: string;
    pkColumn: string;
    pkValue: string | number;
    updates: Record<string, unknown>;
  }): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('dev:update-row', payload),
  devInsertRow: (payload: {
    tableName: string;
    values: Record<string, unknown>;
  }): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('dev:insert-row', payload),
  devDeleteRow: (payload: {
    tableName: string;
    pkColumn: string;
    pkValue: string | number;
  }): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('dev:delete-row', payload),
  devExecuteSql: (sqlQuery: string): Promise<SqlQueryExecutionResult> =>
    ipcRenderer.invoke('dev:execute-sql', sqlQuery),
  devVacuumDb: (): Promise<{ ok: boolean; sizeBytes: number; error?: string }> =>
    ipcRenderer.invoke('dev:vacuum-db'),
  devGetDiagnostics: (): Promise<DevDiagnosticsInfo> =>
    ipcRenderer.invoke('dev:get-diagnostics'),
  devClearCaches: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('dev:clear-caches'),
  devClearIncognito: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('dev:clear-incognito'),
  devShowDbInFolder: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('dev:show-db-in-folder'),
  devToggleDevTools: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('dev:toggle-devtools'),

  onStreamChunk: (callback: (payload: StreamChunkPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: StreamChunkPayload) =>
      callback(payload);
    ipcRenderer.on('chat:stream-chunk', listener);
    return () => {
      ipcRenderer.removeListener('chat:stream-chunk', listener);
    };
  },

  onSystemThemeChanged: (callback: (isDark: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isDark: boolean) => callback(isDark);
    ipcRenderer.on('theme:system-changed', listener);
    return () => {
      ipcRenderer.removeListener('theme:system-changed', listener);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronApi);

export type ElectronAPI = typeof electronApi;
