import type { AiProviderConfig } from '../types/chat';

export function formatLocalDateTime(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  const kb = bytes / 1024;
  if (kb >= 1) return `${kb.toFixed(0)} KB`;
  return `${bytes} B`;
}

export function isExternalProviderModel(model?: string): boolean {
  return Boolean(model && model.startsWith('provider::'));
}

export function makeProviderModelValue(providerId: string, modelId: string): string {
  return `provider::${providerId}::${modelId}`;
}

export function formatModelDisplayName(
  model?: string,
  providers: AiProviderConfig[] = []
): string {
  if (!model) return '';
  if (model.startsWith('provider::')) {
    const parts = model.split('::');
    if (parts.length >= 3) {
      const providerId = parts[1];
      const modelId = parts.slice(2).join('::');
      const found = providers.find((p) => p.id === providerId);
      return found ? `${found.name} • ${modelId}` : modelId;
    }
  }
  return model;
}
