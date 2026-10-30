import React from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Server,
  KeyRound,
  Sliders,
  Globe,
  Cpu,
  Bell,
  Volume2,
} from 'lucide-react';
import type {
  AiProviderConfig,
  LanguageCode,
  OllamaModelInfo,
} from '../../types/chat';
import { SUPPORTED_LANGUAGES, useI18n } from '../../i18n';
import { formatBytes, makeProviderModelValue } from '../../utils/formatters';

interface GeneralSettingsTabProps {
  language: LanguageCode;
  onLanguageChange: (value: LanguageCode) => void;
  host: string;
  onHostChange: (value: string) => void;
  ollamaApiKey: string;
  onOllamaApiKeyChange: (value: string) => void;
  theme: 'system' | 'light' | 'dark';
  onThemeChange: (value: 'system' | 'light' | 'dark') => void;
  defaultModel: string;
  onDefaultModelChange: (value: string) => void;
  enableNotifications: boolean;
  onEnableNotificationsChange: (value: boolean) => void;
  threshold: number;
  onThresholdChange: (value: number) => void;
  keepRecent: number;
  onKeepRecentChange: (value: number) => void;
  enableWebTools: boolean;
  onEnableWebToolsChange: (value: boolean) => void;
  soundEnabled: boolean;
  onSoundEnabledChange: (value: boolean) => void;
  models: OllamaModelInfo[];
  providers: AiProviderConfig[];
  onSubmit: (e: React.FormEvent) => void;
}

export const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
  language,
  onLanguageChange,
  host,
  onHostChange,
  ollamaApiKey,
  onOllamaApiKeyChange,
  theme,
  onThemeChange,
  defaultModel,
  onDefaultModelChange,
  enableNotifications,
  onEnableNotificationsChange,
  threshold,
  onThresholdChange,
  keepRecent,
  onKeepRecentChange,
  enableWebTools,
  onEnableWebToolsChange,
  soundEnabled,
  onSoundEnabledChange,
  models,
  providers,
  onSubmit,
}) => {
  const { t } = useI18n();
  const enabledProviders = providers.filter((p) => p.enabled && p.models.length > 0);

  return (
    <form id="settings-form" onSubmit={onSubmit} className="space-y-5">
      {/* Language & Theme */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            <Globe className="w-3.5 h-3.5 text-neutral-500" />
            <span>{t.settings.general.languageLabel}</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const active = language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => onLanguageChange(lang.code)}
                  className={`py-2 px-3 rounded-xl border font-medium transition-all ${
                    active
                      ? 'border-neutral-800 dark:border-neutral-200 bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                      : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {lang.nativeName}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t.settings.general.themeLabel}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'system', label: t.settings.general.themeSystem, icon: Monitor },
                { id: 'light', label: t.settings.general.themeLight, icon: Sun },
                { id: 'dark', label: t.settings.general.themeDark, icon: Moon },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = theme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onThemeChange(item.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border font-medium transition-all ${
                    active
                      ? 'border-neutral-800 dark:border-neutral-200 bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                      : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ollama Host & API Key */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            <Server className="w-3.5 h-3.5 text-neutral-500" />
            <span>{t.settings.general.ollamaHostLabel}</span>
          </label>
          <input
            type="text"
            value={host}
            onChange={(e) => onHostChange(e.target.value)}
            placeholder="http://127.0.0.1:11434"
            className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-mono focus:outline-none focus:border-neutral-500"
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            <KeyRound className="w-3.5 h-3.5 text-neutral-500" />
            <span>{t.settings.general.ollamaApiKeyLabel}</span>
          </label>
          <input
            type="password"
            value={ollamaApiKey}
            onChange={(e) => onOllamaApiKeyChange(e.target.value)}
            placeholder={t.settings.general.ollamaApiKeyPlaceholder}
            className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-mono focus:outline-none focus:border-neutral-500"
          />
        </div>
      </div>

      {/* Default Model for New Chats */}
      <div>
        <label className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
          <Cpu className="w-3.5 h-3.5 text-neutral-500" />
          <span>{t.settings.general.defaultModelLabel}</span>
        </label>
        <select
          value={defaultModel}
          onChange={(e) => onDefaultModelChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500"
        >
          <option value="">{t.settings.general.defaultModelAuto}</option>
          {models.length > 0 && (
            <optgroup label={t.composer.localModelsGroup}>
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({formatBytes(m.size)})
                </option>
              ))}
            </optgroup>
          )}
          {enabledProviders.map((prov) => (
            <optgroup key={prov.id} label={`${prov.name} (OpenAI API)`}>
              {prov.models.map((modId) => {
                const val = makeProviderModelValue(prov.id, modId);
                return (
                  <option key={val} value={val}>
                    {prov.name} • {modId}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Desktop Notifications Toggle */}
      <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 flex items-center justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <Bell className="w-4 h-4 text-neutral-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium text-neutral-800 dark:text-neutral-200">
              {t.settings.general.notificationsTitle}
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t.settings.general.notificationsDesc}
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={enableNotifications}
          onChange={(e) => onEnableNotificationsChange(e.target.checked)}
          className="w-4 h-4 accent-neutral-800 dark:accent-neutral-200 cursor-pointer"
        />
      </div>

      {/* UI Sounds Toggle */}
      <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 flex items-center justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <Volume2 className="w-4 h-4 text-neutral-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium text-neutral-800 dark:text-neutral-200">
              {t.settings.general.soundsTitle}
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t.settings.general.soundsDesc}
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={soundEnabled}
          onChange={(e) => onSoundEnabledChange(e.target.checked)}
          className="w-4 h-4 accent-neutral-800 dark:accent-neutral-200 cursor-pointer"
        />
      </div>

      {/* Context Compression Settings */}
      <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 space-y-3">
        <div className="flex items-center gap-1.5 font-medium text-neutral-800 dark:text-neutral-200">
          <Sliders className="w-3.5 h-3.5 text-neutral-500" />
          <span>{t.settings.general.compressionTitle}</span>
        </div>

        <div>
          <div className="flex justify-between text-neutral-600 dark:text-neutral-400 mb-1">
            <span>{t.settings.general.compressionThreshold}</span>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              {threshold}%
            </span>
          </div>
          <input
            type="range"
            min={35}
            max={90}
            step={5}
            value={threshold}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            className="w-full accent-neutral-800 dark:accent-neutral-200"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-neutral-600 dark:text-neutral-400">
            {t.settings.general.keepRecentMessages}
          </span>
          <input
            type="number"
            min={2}
            max={20}
            value={keepRecent}
            onChange={(e) => onKeepRecentChange(Number(e.target.value))}
            className="w-20 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-center"
          />
        </div>
      </div>

      {/* Web Tools Toggle */}
      <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 flex items-center justify-between gap-4">
        <div>
          <div className="font-medium text-neutral-800 dark:text-neutral-200">
            {t.settings.general.webToolsTitle}
          </div>
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t.settings.general.webToolsDesc}
          </div>
        </div>
        <input
          type="checkbox"
          checked={enableWebTools}
          onChange={(e) => onEnableWebToolsChange(e.target.checked)}
          className="w-4 h-4 accent-neutral-800 dark:accent-neutral-200 cursor-pointer"
        />
      </div>
    </form>
  );
};
