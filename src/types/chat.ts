export interface ChatRecord {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  compressedSummary: string;
  compressedUpToId: string | null;
  contextLimit: number;
  incognito?: boolean;
  parentChatId?: string | null;
  parentChatTitle?: string | null;
}

export interface ToolExecutionTrace {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: string;
  status: 'running' | 'done' | 'error';
  timestamp: string;
}

export interface GenerationStats {
  tokensPerSec: number;
  evalCount: number;
  promptEvalCount?: number;
  totalDurationMs?: number;
}

export interface MessageRecord {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  toolCalls?: ToolExecutionTrace[];
  stats?: GenerationStats;
  images?: string[];
  timestamp: string;
  formattedTime: string;
  isCompressed?: boolean;
}

export interface UserMemoryItem {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'http';
  command?: string; // for stdio (e.g., "npx")
  args?: string[]; // for stdio (e.g., ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"])
  env?: Record<string, string>; // for stdio
  url?: string; // for streamable HTTP JSON-RPC endpoint
  enabled: boolean;
  createdAt: string;
}

export interface McpServerStatus extends McpServerConfig {
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  error?: string;
  tools: McpToolInfo[];
}

export interface SkillRecord {
  id: string;
  slug: string; // slash command trigger, e.g., "review", "architect", "ui"
  name: string;
  description: string;
  instructions: string;
  enabled: boolean;
  builtin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OllamaModelInfo {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
  contextLength?: number;
}

export interface OllamaRunningModel {
  name: string;
  model: string;
  size: number;
  size_vram: number;
  digest: string;
  expires_at: string;
}

export type LanguageCode = 'ru' | 'en';

export interface AiProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  enabled: boolean;
  createdAt: string;
}

export interface AppSettings {
  ollamaHost: string;
  ollamaApiKey: string;
  theme: 'system' | 'light' | 'dark';
  language: LanguageCode;
  defaultModel: string;
  enableNotifications: boolean;
  onboardingCompleted: boolean;
  compressionThresholdRatio: number;
  keepRecentMessages: number;
  customSystemPromptAddon: string;
  enableWebTools: boolean;
}

export interface StreamChunkPayload {
  chatId: string;
  messageId: string;
  contentDelta?: string;
  thinkingDelta?: string;
  toolCalls?: ToolExecutionTrace[];
  stats?: GenerationStats;
  done?: boolean;
  error?: string;
  compressionNotice?: string;
  chatTitleUpdated?: string;
  memoriesChanged?: boolean;
  promptEvalCount?: number;
  evalCount?: number;
}

export interface DbColumnSchema {
  name: string;
  type: string;
  notnull: boolean;
  pk: boolean;
  dfltValue: unknown;
}

export interface DbTableInfo {
  name: string;
  rowCount: number;
  sql: string;
  columns: DbColumnSchema[];
}

export interface DbTableRowsResponse {
  tableName: string;
  primaryKey: string | null;
  columns: DbColumnSchema[];
  rows: Array<Record<string, unknown>>;
  totalCount: number;
}

export interface SqlQueryExecutionResult {
  ok: boolean;
  resultSets: Array<{
    columns: string[];
    rows: Array<Record<string, unknown>>;
  }>;
  rowsModified: number;
  durationMs: number;
  error?: string;
}

export interface DevDiagnosticsInfo {
  dbFilePath: string;
  dbFileSizeBytes: number;
  tableCount: number;
  incognitoChatsCount: number;
  incognitoMessagesCount: number;
  incognitoChats: Array<{
    id: string;
    title: string;
    model: string;
    messageCount: number;
    updatedAt: string;
  }>;
  modelContextCache: Array<{ model: string; contextLength: number }>;
  disabledToolsModels: string[];
  versions: {
    electron: string;
    chrome: string;
    node: string;
    platform: string;
    arch: string;
  };
}

