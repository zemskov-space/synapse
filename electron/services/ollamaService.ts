import type { OllamaModelInfo, OllamaRunningModel } from '../../src/types/chat';
export { formatLocalDateTime } from '../../src/utils/formatters';

const modelContextCache = new Map<string, number>();
const modelDisableToolsCache = new Set<string>();

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.4);
}

export function stripBase64Prefix(dataUrlOrBase64: string): string {
  const idx = dataUrlOrBase64.indexOf('base64,');
  if (idx !== -1) {
    return dataUrlOrBase64.slice(idx + 7);
  }
  return dataUrlOrBase64;
}

export function isModelToolsDisabled(modelName: string): boolean {
  return modelDisableToolsCache.has(modelName);
}

export function disableNativeToolsForModel(modelName: string): void {
  modelDisableToolsCache.add(modelName);
}

export function getOllamaCachesDiagnostics(): {
  modelContextCache: Array<{ model: string; contextLength: number }>;
  disabledToolsModels: string[];
} {
  return {
    modelContextCache: Array.from(modelContextCache.entries()).map(([model, contextLength]) => ({
      model,
      contextLength,
    })),
    disabledToolsModels: Array.from(modelDisableToolsCache.values()),
  };
}

export function clearOllamaCaches(): void {
  modelContextCache.clear();
  modelDisableToolsCache.clear();
}

export function buildOllamaHeaders(
  apiKey?: string,
  extraHeaders: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  const cleanKey = apiKey?.trim();
  if (cleanKey) {
    headers['Authorization'] = cleanKey.toLowerCase().startsWith('bearer ')
      ? cleanKey
      : `Bearer ${cleanKey}`;
  }
  return headers;
}

export async function fetchModelContextLength(
  host: string,
  modelName: string,
  apiKey?: string
): Promise<number> {
  if (!modelName) return 8192;
  if (modelName.startsWith('provider::')) {
    return 32768;
  }
  if (modelContextCache.has(modelName)) {
    return modelContextCache.get(modelName)!;
  }

  try {
    const res = await fetch(`${host.replace(/\/$/, '')}/api/show`, {
      method: 'POST',
      headers: buildOllamaHeaders(apiKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name: modelName }),
    });
    if (!res.ok) return 8192;
    const data = (await res.json()) as {
      model_info?: Record<string, unknown>;
      parameters?: string;
    };

    if (typeof data.parameters === 'string') {
      const match = data.parameters.match(/num_ctx\s+(\d+)/i);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (val > 512) {
          modelContextCache.set(modelName, val);
          return val;
        }
      }
    }

    if (data.model_info && typeof data.model_info === 'object') {
      for (const [key, value] of Object.entries(data.model_info)) {
        if (key.endsWith('.context_length') && typeof value === 'number' && value > 512) {
          modelContextCache.set(modelName, value);
          return value;
        }
      }
    }
  } catch {
    // Ignore and fallback
  }

  modelContextCache.set(modelName, 8192);
  return 8192;
}

export async function listOllamaModels(
  host: string,
  apiKey?: string
): Promise<{ ok: boolean; models: OllamaModelInfo[]; error?: string }> {
  const cleanHost = host.replace(/\/$/, '');
  try {
    const res = await fetch(`${cleanHost}/api/tags`, {
      headers: buildOllamaHeaders(apiKey),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: OllamaModelInfo[] };
    return { ok: true, models: data.models || [] };
  } catch (err: unknown) {
    return {
      ok: false,
      models: [],
      error: err instanceof Error ? err.message : 'Не удалось подключиться к Ollama',
    };
  }
}

export async function listRunningOllamaModels(
  host: string,
  apiKey?: string
): Promise<{ ok: boolean; models: OllamaRunningModel[]; error?: string }> {
  const cleanHost = host.replace(/\/$/, '');
  try {
    const res = await fetch(`${cleanHost}/api/ps`, {
      headers: buildOllamaHeaders(apiKey),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: OllamaRunningModel[] };
    return { ok: true, models: data.models || [] };
  } catch (err: unknown) {
    return {
      ok: false,
      models: [],
      error: err instanceof Error ? err.message : 'Ollama недоступна',
    };
  }
}

export async function toggleLoadOllamaModel(
  host: string,
  modelName: string,
  load: boolean,
  apiKey?: string
): Promise<{ ok: boolean; error?: string }> {
  if (modelName.startsWith('provider::')) {
    return { ok: true };
  }
  const cleanHost = host.replace(/\/$/, '');
  try {
    const res = await fetch(`${cleanHost}/api/generate`, {
      method: 'POST',
      headers: buildOllamaHeaders(apiKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        model: modelName,
        prompt: '',
        keep_alive: load ? '10m' : 0,
      }),
    });
    return { ok: res.ok };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' };
  }
}
