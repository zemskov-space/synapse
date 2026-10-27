import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import type { McpServerConfig, McpServerStatus, McpToolInfo } from '../src/types/chat';
import { listMcpServers } from './db';
import type { OllamaToolDefinition } from './tools';

interface PendingRpcRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

class StdioMcpConnection {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private buffer = '';
  private nextId = 1;
  private pending = new Map<number, PendingRpcRequest>();
  public status: 'connected' | 'disconnected' | 'connecting' | 'error' = 'disconnected';
  public error?: string;
  public tools: McpToolInfo[] = [];

  constructor(private config: McpServerConfig) {}

  async connect(): Promise<void> {
    this.disconnect();
    if (!this.config.command?.trim()) {
      this.status = 'error';
      this.error = 'Не указана команда запуска (command)';
      return;
    }

    this.status = 'connecting';
    this.error = undefined;

    try {
      // Augment PATH so common locations like /opt/homebrew/bin and /usr/local/bin are found in packaged macOS apps
      const extraPath =
        process.platform === 'win32'
          ? ''
          : '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
      const mergedEnv: NodeJS.ProcessEnv = {
        ...process.env,
        PATH:
          extraPath && process.env.PATH
            ? `${process.env.PATH}${path.delimiter}${extraPath}`
            : process.env.PATH || extraPath,
        ...(this.config.env || {}),
      };

      this.proc = spawn(this.config.command.trim(), this.config.args || [], {
        env: mergedEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      this.proc.stdout.on('data', (chunk: Buffer) => {
        this.handleStdout(chunk.toString('utf8'));
      });

      this.proc.stderr.on('data', (chunk: Buffer) => {
        const msg = chunk.toString('utf8').trim();
        if (msg && this.status === 'connecting') {
          this.error = msg.slice(0, 300);
        }
      });

      this.proc.on('error', (err) => {
        this.status = 'error';
        this.error = err.message;
        this.rejectAllPending(err);
      });

      this.proc.on('exit', (code) => {
        if (this.status === 'connected' || this.status === 'connecting') {
          this.status = code === 0 ? 'disconnected' : 'error';
          if (code !== 0 && !this.error) {
            this.error = `Процесс завершился с кодом ${code}`;
          }
        }
        this.rejectAllPending(new Error(`MCP процесс завершился (код ${code})`));
      });

      // 1. Send initialize request
      await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'Synapse',
          version: '1.0.0',
        },
      });

      // 2. Send notifications/initialized
      this.sendNotification('notifications/initialized', {});

      // 3. Fetch tools/list
      const toolsRes = (await this.sendRequest('tools/list', {})) as {
        tools?: McpToolInfo[];
      };

      this.tools = Array.isArray(toolsRes?.tools) ? toolsRes.tools : [];
      this.status = 'connected';
      this.error = undefined;
    } catch (err: unknown) {
      this.status = 'error';
      this.error = err instanceof Error ? err.message : 'Ошибка инициализации MCP';
      this.disconnect(true);
    }
  }

  private handleStdout(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('{')) continue;
      try {
        const msg = JSON.parse(trimmed) as {
          id?: number;
          result?: unknown;
          error?: { message?: string };
        };
        if (typeof msg.id === 'number' && this.pending.has(msg.id)) {
          const req = this.pending.get(msg.id)!;
          clearTimeout(req.timer);
          this.pending.delete(msg.id);
          if (msg.error) {
            req.reject(new Error(msg.error.message || 'MCP RPC Error'));
          } else {
            req.resolve(msg.result);
          }
        }
      } catch {
        // Ignore non-JSON log lines
      }
    }
  }

  private sendNotification(method: string, params: Record<string, unknown>): void {
    if (!this.proc || !this.proc.stdin.writable) return;
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
    });
    this.proc.stdin.write(payload + '\n');
  }

  public sendRequest(method: string, params: Record<string, unknown>, timeoutMs = 15000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.proc || !this.proc.stdin.writable) {
        return reject(new Error('MCP процесс не запущен'));
      }
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Таймаут запроса MCP (${method})`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      const payload = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      });
      this.proc.stdin.write(payload + '\n');
    });
  }

  private rejectAllPending(err: Error): void {
    for (const req of this.pending.values()) {
      clearTimeout(req.timer);
      req.reject(err);
    }
    this.pending.clear();
  }

  public disconnect(keepErrorStatus = false): void {
    this.rejectAllPending(new Error('Отключено'));
    if (this.proc) {
      try {
        this.proc.kill();
      } catch {
        // ignore
      }
      this.proc = null;
    }
    if (!keepErrorStatus) {
      this.status = 'disconnected';
      this.error = undefined;
      this.tools = [];
    }
  }
}

class HttpMcpConnection {
  private nextId = 1;
  public status: 'connected' | 'disconnected' | 'connecting' | 'error' = 'disconnected';
  public error?: string;
  public tools: McpToolInfo[] = [];

  constructor(private config: McpServerConfig) {}

  async connect(): Promise<void> {
    if (!this.config.url?.trim()) {
      this.status = 'error';
      this.error = 'Не указан URL для HTTP MCP сервера';
      return;
    }
    this.status = 'connecting';
    this.error = undefined;

    try {
      await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'Synapse', version: '1.0.0' },
      });

      const toolsRes = (await this.sendRequest('tools/list', {})) as {
        tools?: McpToolInfo[];
      };
      this.tools = Array.isArray(toolsRes?.tools) ? toolsRes.tools : [];
      this.status = 'connected';
    } catch (err: unknown) {
      this.status = 'error';
      this.error = err instanceof Error ? err.message : 'Ошибка подключения к HTTP MCP';
      this.tools = [];
    }
  }

  async sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    const url = this.config.url!.trim();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.nextId++,
        method,
        params,
      }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      result?: unknown;
      error?: { message?: string };
    };
    if (json.error) {
      throw new Error(json.error.message || 'MCP HTTP RPC Error');
    }
    return json.result;
  }

  disconnect(): void {
    this.status = 'disconnected';
    this.error = undefined;
    this.tools = [];
  }
}

const activeConnections = new Map<string, StdioMcpConnection | HttpMcpConnection>();

export async function syncAllMcpServers(): Promise<McpServerStatus[]> {
  const configs = listMcpServers();
  const validIds = new Set(configs.map((c) => c.id));

  // Disconnect removed servers
  for (const [id, conn] of activeConnections.entries()) {
    if (!validIds.has(id)) {
      conn.disconnect();
      activeConnections.delete(id);
    }
  }

  for (const cfg of configs) {
    const existing = activeConnections.get(cfg.id);
    if (!cfg.enabled) {
      if (existing) {
        existing.disconnect();
        activeConnections.delete(cfg.id);
      }
      continue;
    }

    if (!existing || existing.status === 'disconnected') {
      const conn =
        cfg.transport === 'http'
          ? new HttpMcpConnection(cfg)
          : new StdioMcpConnection(cfg);
      activeConnections.set(cfg.id, conn);
      await conn.connect();
    }
  }

  return getMcpServersStatus();
}

export async function reconnectMcpServer(serverId: string): Promise<McpServerStatus[]> {
  const configs = listMcpServers();
  const cfg = configs.find((c) => c.id === serverId);
  const existing = activeConnections.get(serverId);
  if (existing) {
    existing.disconnect();
    activeConnections.delete(serverId);
  }
  if (cfg && cfg.enabled) {
    const conn =
      cfg.transport === 'http'
        ? new HttpMcpConnection(cfg)
        : new StdioMcpConnection(cfg);
    activeConnections.set(cfg.id, conn);
    await conn.connect();
  }
  return getMcpServersStatus();
}

export function getMcpServersStatus(): McpServerStatus[] {
  const configs = listMcpServers();
  return configs.map((cfg) => {
    const conn = activeConnections.get(cfg.id);
    return {
      ...cfg,
      status: conn ? conn.status : 'disconnected',
      error: conn?.error,
      tools: conn?.tools || [],
    };
  });
}

export function disconnectAllMcpServers(): void {
  for (const conn of activeConnections.values()) {
    conn.disconnect();
  }
  activeConnections.clear();
}

/**
 * Returns Ollama-compatible tool definitions for all currently connected MCP servers.
 * Tool names are namespaced as `mcp__<serverIdShort>__<toolName>` so we can route calls back.
 */
export function getConnectedMcpToolsForOllama(): OllamaToolDefinition[] {
  const configs = listMcpServers();
  const defs: OllamaToolDefinition[] = [];

  for (const cfg of configs) {
    if (!cfg.enabled) continue;
    const conn = activeConnections.get(cfg.id);
    if (!conn || conn.status !== 'connected') continue;

    for (const tool of conn.tools) {
      const namespacedName = `mcp__${cfg.id.slice(0, 8)}__${tool.name}`;
      const schema = (tool.inputSchema || {
        type: 'object',
        properties: {},
      }) as {
        type: 'object';
        properties: Record<string, { type: string; description: string }>;
        required?: string[];
      };

      defs.push({
        type: 'function',
        function: {
          name: namespacedName,
          description: `[MCP: ${cfg.name}] ${tool.description || tool.name}`,
          parameters: {
            type: 'object',
            properties: schema.properties || {},
            required: schema.required || [],
          },
        },
      });
    }
  }

  return defs;
}

/**
 * Executes a namespaced MCP tool call `mcp__<serverIdPrefix>__<toolName>`.
 */
export async function executeMcpToolCall(
  namespacedName: string,
  args: Record<string, unknown>
): Promise<string> {
  const match = namespacedName.match(/^mcp__([a-zA-Z0-9_-]{8})__(.+)$/);
  if (!match) {
    return JSON.stringify({ ok: false, error: `Некорректное имя MCP функции: ${namespacedName}` });
  }
  const serverPrefix = match[1];
  const rawToolName = match[2];

  const configs = listMcpServers();
  const cfg = configs.find((c) => c.id.startsWith(serverPrefix) && c.enabled);
  if (!cfg) {
    return JSON.stringify({ ok: false, error: 'MCP сервер не найден или отключен' });
  }

  const conn = activeConnections.get(cfg.id);
  if (!conn || conn.status !== 'connected') {
    return JSON.stringify({ ok: false, error: `MCP сервер "${cfg.name}" не подключен` });
  }

  try {
    const res = (await conn.sendRequest('tools/call', {
      name: rawToolName,
      arguments: args || {},
    })) as {
      content?: Array<{ type?: string; text?: string }>;
      isError?: boolean;
    };

    let parsedOutput: unknown;
    if (Array.isArray(res?.content)) {
      if (res.content.length === 1 && typeof res.content[0]?.text === 'string') {
        const rawText = res.content[0].text.trim();
        try {
          parsedOutput = JSON.parse(rawText);
        } catch {
          parsedOutput = res.content[0].text;
        }
      } else {
        const parts = res.content.map((c) => {
          if (typeof c.text === 'string') {
            try {
              return JSON.parse(c.text.trim());
            } catch {
              return c.text;
            }
          }
          return c;
        });
        parsedOutput = parts.length === 1 ? parts[0] : parts;
      }
    } else {
      parsedOutput = res;
    }

    return JSON.stringify(
      {
        ok: !res?.isError,
        mcpServer: cfg.name,
        tool: rawToolName,
        output: parsedOutput,
      },
      null,
      2
    );
  } catch (err: unknown) {
    return JSON.stringify({
      ok: false,
      mcpServer: cfg.name,
      tool: rawToolName,
      error: err instanceof Error ? err.message : 'Ошибка вызова MCP инструмента',
    });
  }
}
