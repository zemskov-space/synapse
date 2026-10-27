import type { AiProviderConfig } from '../../src/types/chat';
import { listAiProviders } from '../db';

export interface ParsedModelRef {
  isExternal: boolean;
  providerId?: string;
  modelId: string;
}

export function parseProviderModelRef(modelStr: string): ParsedModelRef {
  if (modelStr && modelStr.startsWith('provider::')) {
    const parts = modelStr.split('::');
    if (parts.length >= 3) {
      return {
        isExternal: true,
        providerId: parts[1],
        modelId: parts.slice(2).join('::'),
      };
    }
  }
  return {
    isExternal: false,
    modelId: modelStr || 'llama3.2',
  };
}

export function resolveExternalProvider(
  modelStr: string
): { provider: AiProviderConfig; modelId: string } | null {
  const parsed = parseProviderModelRef(modelStr);
  if (!parsed.isExternal || !parsed.providerId) return null;
  const providers = listAiProviders();
  const provider = providers.find((p) => p.id === parsed.providerId);
  if (!provider) return null;
  return { provider, modelId: parsed.modelId };
}

export function buildOpenAiHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const cleanKey = apiKey?.trim();
  if (cleanKey) {
    headers['Authorization'] = cleanKey.toLowerCase().startsWith('bearer ')
      ? cleanKey
      : `Bearer ${cleanKey}`;
  }
  return headers;
}

export function normalizeOpenAiBaseUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  if (clean.endsWith('/chat/completions')) {
    return clean.replace(/\/chat\/completions$/, '');
  }
  return clean;
}

export async function fetchOpenAiProviderModels(
  baseUrl: string,
  apiKey?: string
): Promise<{ ok: boolean; models: string[]; error?: string }> {
  const root = normalizeOpenAiBaseUrl(baseUrl);
  if (!root) {
    return { ok: false, models: [], error: 'Не указан Base URL провайдера' };
  }

  try {
    const res = await fetch(`${root}/models`, {
      method: 'GET',
      headers: buildOpenAiHeaders(apiKey),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${errText ? `: ${errText.slice(0, 180)}` : ''}`);
    }
    const json = (await res.json()) as {
      data?: Array<{ id?: string }>;
      models?: Array<{ id?: string; name?: string }>;
    };
    const list: string[] = [];
    if (Array.isArray(json.data)) {
      for (const item of json.data) {
        if (item && typeof item.id === 'string' && item.id.trim()) {
          list.push(item.id.trim());
        }
      }
    } else if (Array.isArray(json.models)) {
      for (const item of json.models) {
        const id = item?.id || item?.name;
        if (typeof id === 'string' && id.trim()) {
          list.push(id.trim());
        }
      }
    }
    return {
      ok: true,
      models: Array.from(new Set(list)).sort((a, b) => a.localeCompare(b)),
    };
  } catch (err: unknown) {
    return {
      ok: false,
      models: [],
      error: err instanceof Error ? err.message : 'Ошибка запроса /models',
    };
  }
}
