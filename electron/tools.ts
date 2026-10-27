import type { LanguageCode } from '../src/types/chat';
import { getTranslationDictionary } from '../src/i18n';
import {
  addUserMemory,
  updateUserMemory,
  deleteUserMemory,
  listUserMemories,
} from './db';
import { getConnectedMcpToolsForOllama, executeMcpToolCall } from './mcp';
import {
  performDirectWebSearch,
  fetchDirectWebPageContent,
} from './services/webScraper';

export { performDirectWebSearch, fetchDirectWebPageContent };

export interface OllamaToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required?: string[];
    };
  };
}

export interface ToolExecutionContext {
  chatId: string;
  incognito: boolean;
  language?: LanguageCode;
  onRenameChat: (newTitle: string) => void;
  onMemoriesModified: () => void;
}

/**
 * Returns the list of available tools in Ollama / MCP-ready schema format,
 * localized according to the user's selected interface language.
 * Notice that in Incognito mode, memory mutation tools are omitted and blocked on execution.
 */
export function getAvailableTools(options: {
  incognito: boolean;
  enableWebTools: boolean;
  language?: LanguageCode;
}): OllamaToolDefinition[] {
  const td = getTranslationDictionary(options.language || 'ru').toolDefinitions;

  const tools: OllamaToolDefinition[] = [
    {
      type: 'function',
      function: {
        name: 'rename_chat',
        description: td.renameChatDesc,
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: td.renameChatParamTitle,
            },
          },
          required: ['title'],
        },
      },
    },
  ];

  // Memory write/update/delete tools are only exposed in non-incognito chats
  if (!options.incognito) {
    tools.push(
      {
        type: 'function',
        function: {
          name: 'memory_add',
          description: td.memoryAddDesc,
          parameters: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: td.memoryAddParamContent,
              },
            },
            required: ['content'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'memory_update',
          description: td.memoryUpdateDesc,
          parameters: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: td.memoryUpdateParamId,
              },
              content: {
                type: 'string',
                description: td.memoryUpdateParamContent,
              },
            },
            required: ['id', 'content'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'memory_delete',
          description: td.memoryDeleteDesc,
          parameters: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: td.memoryDeleteParamId,
              },
            },
            required: ['id'],
          },
        },
      }
    );
  }

  if (options.enableWebTools) {
    tools.push(
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: td.webSearchDesc,
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: td.webSearchParamQuery,
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'fetch_web_page',
          description: td.fetchWebPageDesc,
          parameters: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: td.fetchWebPageParamUrl,
              },
            },
            required: ['url'],
          },
        },
      }
    );
  }

  // Append all tools from currently connected MCP servers
  const mcpTools = getConnectedMcpToolsForOllama();
  tools.push(...mcpTools);

  return tools;
}

/**
 * Executes a single tool call requested by the LLM and returns a JSON string result.
 */
export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<string> {
  const td = getTranslationDictionary(ctx.language || 'ru').toolDefinitions;

  try {
    switch (name) {
      case 'rename_chat': {
        const rawTitle = String(args.title || '').replace(/\s+/g, ' ').trim();
        if (!rawTitle) {
          return JSON.stringify({ ok: false, error: td.renameChatEmptyError });
        }
        const cleanTitle = rawTitle.slice(0, 80);
        ctx.onRenameChat(cleanTitle);
        return JSON.stringify({
          ok: true,
          message: `${td.renameChatSuccessPrefix} "${cleanTitle}". ${td.renameChatSuccessSuffix}`,
        });
      }

      case 'memory_add': {
        if (ctx.incognito) {
          return JSON.stringify({
            ok: false,
            error: td.memoryAddIncognitoError,
          });
        }
        const content = String(args.content || '').trim();
        if (!content) {
          return JSON.stringify({ ok: false, error: td.memoryAddEmptyError });
        }
        const created = addUserMemory(content);
        ctx.onMemoriesModified();
        return JSON.stringify({
          ok: true,
          memory: created,
          message: td.memoryAddSuccess,
        });
      }

      case 'memory_update': {
        if (ctx.incognito) {
          return JSON.stringify({
            ok: false,
            error: td.memoryUpdateIncognitoError,
          });
        }
        const id = String(args.id || '').trim();
        const content = String(args.content || '').trim();
        if (!id || !content) {
          return JSON.stringify({ ok: false, error: td.memoryUpdateParamsError });
        }
        const existing = listUserMemories().find((m) => m.id === id);
        if (!existing) {
          return JSON.stringify({
            ok: false,
            error: `${td.memoryNotFoundErrorPrefix} "${id}"`,
          });
        }
        const updated = updateUserMemory(id, content);
        ctx.onMemoriesModified();
        return JSON.stringify({
          ok: true,
          memory: updated,
          message: `${td.memoryUpdateSuccessPrefix} ${id}`,
        });
      }

      case 'memory_delete': {
        if (ctx.incognito) {
          return JSON.stringify({
            ok: false,
            error: td.memoryDeleteIncognitoError,
          });
        }
        const id = String(args.id || '').trim();
        if (!id) {
          return JSON.stringify({ ok: false, error: td.memoryDeleteParamsError });
        }
        const existing = listUserMemories().find((m) => m.id === id);
        if (!existing) {
          return JSON.stringify({
            ok: false,
            error: `${td.memoryNotFoundErrorPrefix} "${id}"`,
          });
        }
        deleteUserMemory(id);
        ctx.onMemoriesModified();
        return JSON.stringify({
          ok: true,
          deletedId: id,
          message: `${td.memoryDeleteSuccessPrefix} ${id}`,
        });
      }

      case 'web_search': {
        const query = String(args.query || '').trim();
        if (!query) {
          return JSON.stringify({ ok: false, error: td.webSearchEmptyError });
        }
        const results = await performDirectWebSearch(query, 6);
        return JSON.stringify({
          ok: true,
          query,
          resultsCount: results.length,
          results,
        });
      }

      case 'fetch_web_page': {
        const url = String(args.url || '').trim();
        if (!url) {
          return JSON.stringify({ ok: false, error: td.fetchWebPageEmptyError });
        }
        const page = await fetchDirectWebPageContent(url, 10000);
        return JSON.stringify({
          ok: true,
          ...page,
        });
      }

      default: {
        if (name.startsWith('mcp__')) {
          return await executeMcpToolCall(name, args);
        }
        return JSON.stringify({
          ok: false,
          error: `${td.unknownToolErrorPrefix} ${name}`,
        });
      }
    }
  } catch (err: unknown) {
    return JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : td.executionErrorDefault,
    });
  }
}
