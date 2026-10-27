import React, { useState } from 'react';
import {
  Cloud,
  Plus,
  Trash2,
  Pencil,
  Check,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import type { AiProviderConfig } from '../../types/chat';
import { useI18n } from '../../i18n';

interface ProvidersSettingsTabProps {
  providers: AiProviderConfig[];
  onSaveProvider: (
    provider: Omit<AiProviderConfig, 'id' | 'createdAt'> & { id?: string }
  ) => Promise<void>;
  onDeleteProvider: (id: string) => Promise<void>;
}

const PROVIDER_PRESETS = [
  {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModels: 'anthropic/claude-3.5-sonnet, openai/gpt-4o, deepseek/deepseek-r1',
  },
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModels: 'gpt-4o, gpt-4o-mini, o3-mini',
  },
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModels: 'deepseek-chat, deepseek-reasoner',
  },
  {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModels: 'llama-3.3-70b-versatile, deepseek-r1-distill-llama-70b',
  },
];

export const ProvidersSettingsTab: React.FC<ProvidersSettingsTabProps> = ({
  providers,
  onSaveProvider,
  onDeleteProvider,
}) => {
  const { t } = useI18n();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelsText, setModelsText] = useState('');
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setBaseUrl('');
    setApiKey('');
    setModelsText('');
    setFetchError(null);
  };

  const applyPreset = (preset: (typeof PROVIDER_PRESETS)[number]) => {
    setName(preset.name);
    setBaseUrl(preset.baseUrl);
    if (!modelsText.trim()) {
      setModelsText(preset.defaultModels);
    }
    setFetchError(null);
  };

  const startEdit = (p: AiProviderConfig) => {
    setEditingId(p.id);
    setName(p.name);
    setBaseUrl(p.baseUrl);
    setApiKey(p.apiKey);
    setModelsText(p.models.join(', '));
    setFetchError(null);
  };

  const handleFetchModelsFromApi = async () => {
    if (!baseUrl.trim()) return;
    setIsFetchingModels(true);
    setFetchError(null);
    try {
      const res = await window.electronAPI.fetchProviderModels({
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
      });
      if (res.ok && res.models.length > 0) {
        setModelsText(res.models.slice(0, 40).join(', '));
      } else {
        setFetchError(res.error || 'Models list is empty');
      }
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch /models');
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !baseUrl.trim()) return;
    const parsedModels = modelsText
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    await onSaveProvider({
      id: editingId || undefined,
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      models: parsedModels,
      enabled: true,
    });
    resetForm();
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 text-neutral-600 dark:text-neutral-400 leading-relaxed">
        {t.settings.providers.intro}
      </div>

      {/* Add / Edit Provider Form */}
      <form
        onSubmit={handleSubmit}
        className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 space-y-3"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="font-medium text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5" />
            <span>
              {editingId ? t.settings.providers.editTitle : t.settings.providers.addTitle}
            </span>
          </span>

          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="text-[11px] text-neutral-500 underline"
            >
              {t.common.cancel}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-neutral-400">
                {t.settings.providers.presetsLabel}
              </span>
              {PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-medium text-neutral-700 dark:text-neutral-300"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.settings.providers.namePlaceholder}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
            required
          />
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={t.settings.providers.baseUrlPlaceholder}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono"
            required
          />
        </div>

        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t.settings.providers.apiKeyPlaceholder}
          className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono"
        />

        <div className="space-y-1.5">
          <textarea
            rows={2}
            value={modelsText}
            onChange={(e) => setModelsText(e.target.value)}
            placeholder={t.settings.providers.modelsPlaceholder}
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono text-[11px]"
            required
          />
          {fetchError && (
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-400">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{fetchError}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={!baseUrl.trim() || isFetchingModels}
            onClick={handleFetchModelsFromApi}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingModels ? 'animate-spin' : ''}`} />
            <span>
              {isFetchingModels
                ? t.settings.providers.fetchingModels
                : t.settings.providers.fetchModelsBtn}
            </span>
          </button>

          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 font-medium inline-flex items-center gap-1.5"
          >
            {editingId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>
              {editingId ? t.settings.providers.saveBtn : t.settings.providers.addBtn}
            </span>
          </button>
        </div>
      </form>

      {/* Providers List */}
      <div className="space-y-2">
        {providers.length === 0 ? (
          <div className="py-8 text-center text-neutral-400">{t.settings.providers.empty}</div>
        ) : (
          providers.map((p) => (
            <div
              key={p.id}
              className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/50 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      p.enabled
                        ? 'bg-neutral-800 dark:bg-neutral-200'
                        : 'bg-neutral-300 dark:bg-neutral-700'
                    }`}
                  />
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {p.name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-mono text-neutral-500">
                    OpenAI API
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    ({t.settings.providers.modelsCount} {p.models.length})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) =>
                      onSaveProvider({
                        id: p.id,
                        name: p.name,
                        baseUrl: p.baseUrl,
                        apiKey: p.apiKey,
                        models: p.models,
                        enabled: e.target.checked,
                      })
                    }
                    className="w-3.5 h-3.5 accent-neutral-800 dark:accent-neutral-200 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="p-1 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-neutral-500"
                    title={t.common.edit}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteProvider(p.id)}
                    className="p-1 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-neutral-500"
                    title={t.common.delete}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="text-[11px] font-mono text-neutral-500 truncate">{p.baseUrl}</div>

              {p.models.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {p.models.map((m) => (
                    <span
                      key={m}
                      className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-mono text-[10px] text-neutral-700 dark:text-neutral-300"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
