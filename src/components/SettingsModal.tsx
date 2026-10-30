import React, { useEffect, useState } from 'react';
import {
  X,
  Sliders,
  FileText,
  BrainCircuit,
  Blocks,
  Wand2,
  Info,
  Cloud,
} from 'lucide-react';
import type {
  AiProviderConfig,
  AppSettings,
  LanguageCode,
  OllamaModelInfo,
  UserMemoryItem,
  McpServerStatus,
  McpServerConfig,
  SkillRecord,
} from '../types/chat';
import { useI18n } from '../i18n';
import { GeneralSettingsTab } from './settings/GeneralSettingsTab';
import { ProvidersSettingsTab } from './settings/ProvidersSettingsTab';
import { MemorySettingsTab } from './settings/MemorySettingsTab';
import { McpSettingsTab } from './settings/McpSettingsTab';
import { SkillsSettingsTab } from './settings/SkillsSettingsTab';
import { PromptSettingsTab } from './settings/PromptSettingsTab';
import { AboutSettingsTab } from './settings/AboutSettingsTab';

export type SettingsTabId =
  | 'general'
  | 'providers'
  | 'memory'
  | 'mcp'
  | 'skills'
  | 'prompt'
  | 'about';

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: SettingsTabId;
  settings: AppSettings;
  models: OllamaModelInfo[];
  providers: AiProviderConfig[];
  memories: UserMemoryItem[];
  mcpServers: McpServerStatus[];
  skills: SkillRecord[];
  onClose: () => void;
  onSave: (partial: Partial<AppSettings>) => Promise<void>;
  onSaveProvider: (
    provider: Omit<AiProviderConfig, 'id' | 'createdAt'> & { id?: string }
  ) => Promise<void>;
  onDeleteProvider: (id: string) => Promise<void>;
  onAddMemory: (content: string) => Promise<void>;
  onUpdateMemory: (id: string, content: string) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  onClearMemories: () => Promise<void>;
  onSaveMcpServer: (
    server: Omit<McpServerConfig, 'id' | 'createdAt'> & { id?: string }
  ) => Promise<void>;
  onDeleteMcpServer: (id: string) => Promise<void>;
  onReconnectMcpServer: (id: string) => Promise<void>;
  onSaveSkill: (
    skill: Omit<SkillRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  onDeleteSkill: (id: string) => Promise<void>;
  onOpenDatabaseEditor: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  initialTab = 'general',
  settings,
  models,
  providers,
  memories,
  mcpServers,
  skills,
  onClose,
  onSave,
  onSaveProvider,
  onDeleteProvider,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
  onClearMemories,
  onSaveMcpServer,
  onDeleteMcpServer,
  onReconnectMcpServer,
  onSaveSkill,
  onDeleteSkill,
  onOpenDatabaseEditor,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  const [language, setLanguage] = useState<LanguageCode>(settings.language || 'ru');
  const [host, setHost] = useState(settings.ollamaHost);
  const [ollamaApiKey, setOllamaApiKey] = useState(settings.ollamaApiKey || '');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(settings.theme);
  const [defaultModel, setDefaultModel] = useState(settings.defaultModel || '');
  const [enableNotifications, setEnableNotifications] = useState(
    settings.enableNotifications !== false
  );
  const [threshold, setThreshold] = useState(
    Math.round(settings.compressionThresholdRatio * 100)
  );
  const [keepRecent, setKeepRecent] = useState(settings.keepRecentMessages);
  const [customPrompt, setCustomPrompt] = useState(settings.customSystemPromptAddon || '');
  const [enableWebTools, setEnableWebTools] = useState(settings.enableWebTools !== false);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled === true);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    setLanguage(settings.language || 'ru');
    setHost(settings.ollamaHost);
    setOllamaApiKey(settings.ollamaApiKey || '');
    setTheme(settings.theme);
    setDefaultModel(settings.defaultModel || '');
    setEnableNotifications(settings.enableNotifications !== false);
    setThreshold(Math.round(settings.compressionThresholdRatio * 100));
    setKeepRecent(settings.keepRecentMessages);
    setCustomPrompt(settings.customSystemPromptAddon || '');
    setEnableWebTools(settings.enableWebTools !== false);
    setSoundEnabled(settings.soundEnabled === true);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      language,
      ollamaHost: host.trim() || 'http://127.0.0.1:11434',
      ollamaApiKey: ollamaApiKey.trim(),
      theme,
      defaultModel,
      enableNotifications,
      compressionThresholdRatio: Math.min(0.95, Math.max(0.3, threshold / 100)),
      keepRecentMessages: Math.max(2, Math.min(20, keepRecent)),
      customSystemPromptAddon: customPrompt,
      enableWebTools,
      soundEnabled,
    });
    onClose();
  };

  const connectedMcpCount = mcpServers.filter((s) => s.status === 'connected').length;
  const enabledProvidersCount = providers.filter((p) => p.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t.settings.modalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap border-b border-neutral-200 dark:border-neutral-800 px-5 bg-neutral-50/70 dark:bg-neutral-950/40 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t.settings.tabs.general}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('providers')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'providers'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>
              {t.settings.tabs.providers} ({enabledProvidersCount})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('memory')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'memory'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>
              {t.settings.tabs.memory} ({memories.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mcp')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'mcp'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Blocks className="w-3.5 h-3.5" />
            <span>
              {t.settings.tabs.mcp} ({connectedMcpCount}/{mcpServers.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('skills')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'skills'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>
              {t.settings.tabs.skills} ({skills.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('prompt')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'prompt'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t.settings.tabs.prompt}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'about'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>{t.settings.tabs.about}</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 text-xs">
          {activeTab === 'general' && (
            <GeneralSettingsTab
              language={language}
              onLanguageChange={setLanguage}
              host={host}
              onHostChange={setHost}
              ollamaApiKey={ollamaApiKey}
              onOllamaApiKeyChange={setOllamaApiKey}
              theme={theme}
              onThemeChange={setTheme}
              defaultModel={defaultModel}
              onDefaultModelChange={setDefaultModel}
              enableNotifications={enableNotifications}
              onEnableNotificationsChange={setEnableNotifications}
              threshold={threshold}
              onThresholdChange={setThreshold}
              keepRecent={keepRecent}
              onKeepRecentChange={setKeepRecent}
              enableWebTools={enableWebTools}
              onEnableWebToolsChange={setEnableWebTools}
              soundEnabled={soundEnabled}
              onSoundEnabledChange={setSoundEnabled}
              models={models}
              providers={providers}
              onSubmit={handleSave}
            />
          )}

          {activeTab === 'providers' && (
            <ProvidersSettingsTab
              providers={providers}
              onSaveProvider={onSaveProvider}
              onDeleteProvider={onDeleteProvider}
            />
          )}

          {activeTab === 'memory' && (
            <MemorySettingsTab
              memories={memories}
              onAddMemory={onAddMemory}
              onUpdateMemory={onUpdateMemory}
              onDeleteMemory={onDeleteMemory}
              onClearMemories={onClearMemories}
            />
          )}

          {activeTab === 'mcp' && (
            <McpSettingsTab
              mcpServers={mcpServers}
              onSaveMcpServer={onSaveMcpServer}
              onDeleteMcpServer={onDeleteMcpServer}
              onReconnectMcpServer={onReconnectMcpServer}
            />
          )}

          {activeTab === 'skills' && (
            <SkillsSettingsTab
              skills={skills}
              onSaveSkill={onSaveSkill}
              onDeleteSkill={onDeleteSkill}
            />
          )}

          {activeTab === 'prompt' && (
            <PromptSettingsTab
              customPrompt={customPrompt}
              onCustomPromptChange={setCustomPrompt}
              onSubmit={handleSave}
            />
          )}

          {activeTab === 'about' && (
            <AboutSettingsTab
              onUnlockDatabaseEditor={() => {
                onClose();
                onOpenDatabaseEditor();
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {t.common.close}
          </button>
          {(activeTab === 'general' || activeTab === 'prompt') && (
            <button
              type="submit"
              form="settings-form"
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 font-medium shadow-sm"
            >
              {t.settings.saveSettings}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
