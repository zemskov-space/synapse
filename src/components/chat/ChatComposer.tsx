import React, { useRef, useState } from 'react';
import {
  Send,
  Square,
  ImagePlus,
  X,
  Cpu,
  HardDrive,
  RefreshCw,
  Archive,
  Power,
  Gauge,
  Wand2,
  Blocks,
  Cloud,
} from 'lucide-react';
import type {
  AiProviderConfig,
  AppSettings,
  ChatRecord,
  McpServerStatus,
  MessageRecord,
  OllamaModelInfo,
  OllamaRunningModel,
  SkillRecord,
} from '../../types/chat';
import type { SettingsTabId } from '../SettingsModal';
import {
  formatBytes,
  formatModelDisplayName,
  isExternalProviderModel,
  makeProviderModelValue,
} from '../../utils/formatters';
import { useI18n } from '../../i18n';

interface ChatComposerProps {
  activeChat: ChatRecord | null;
  messages: MessageRecord[];
  settings: AppSettings;
  models: OllamaModelInfo[];
  runningModels: OllamaRunningModel[];
  providers: AiProviderConfig[];
  mcpServers: McpServerStatus[];
  skills: SkillRecord[];
  selectedSkills: SkillRecord[];
  onSelectedSkillsChange: React.Dispatch<React.SetStateAction<SkillRecord[]>>;
  isStreaming: boolean;
  isTogglingModelMemory: boolean;
  smoothTokensPerSec: number | null;
  onSendMessage: (text: string, images: string[]) => Promise<void>;
  onStopGeneration: () => Promise<void>;
  onModelChange: (newModel: string) => Promise<void>;
  onRefreshModels: () => Promise<void>;
  onToggleModelMemory: () => Promise<void>;
  onOpenSettings: (tab?: SettingsTabId) => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  activeChat,
  messages,
  settings,
  models,
  runningModels,
  providers,
  mcpServers,
  skills,
  selectedSkills,
  onSelectedSkillsChange,
  isStreaming,
  isTogglingModelMemory,
  smoothTokensPerSec,
  onSendMessage,
  onStopGeneration,
  onModelChange,
  onRefreshModels,
  onToggleModelMemory,
  onOpenSettings,
}) => {
  const { t } = useI18n();
  const [inputText, setInputText] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isSkillMenuOpen, setIsSkillMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState<string | null>(null);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const enabledSkills = skills.filter((s) => s.enabled);
  const filteredSlashSkills =
    slashFilter !== null
      ? enabledSkills.filter(
          (s) =>
            s.slug.toLowerCase().includes(slashFilter.toLowerCase()) ||
            s.name.toLowerCase().includes(slashFilter.toLowerCase())
        )
      : enabledSkills;

  const currentModelName = activeChat?.model || models[0]?.name || '';
  const isExternalModel = isExternalProviderModel(currentModelName);
  const loadedModelInfo = !isExternalModel
    ? runningModels.find(
        (rm) => rm.name === currentModelName || rm.model === currentModelName
      )
    : undefined;

  const enabledProviders = providers.filter((p) => p.enabled && p.models.length > 0);
  const connectedMcpServers = mcpServers.filter((s) => s.status === 'connected');
  const totalConnectedMcpTools = connectedMcpServers.reduce(
    (acc, s) => acc + s.tools.length,
    0
  );

  const activeTokensApprox = messages
    .filter((m) => !m.isCompressed)
    .reduce((sum, m) => sum + Math.ceil((m.content.length + 24) / 3.4), 0);
  const effectiveContextMax = Math.min(activeChat?.contextLimit || 8192, 32768);
  const contextUsagePercent = Math.min(
    100,
    Math.round((activeTokensApprox / effectiveContextMax) * 100)
  );

  const handleSelectSkillFromMenu = (skill: SkillRecord) => {
    onSelectedSkillsChange((prev) =>
      prev.some((s) => s.id === skill.id) ? prev : [...prev, skill]
    );
    setInputText((prev) =>
      prev.replace(/(?:^|\s)\/[a-zA-Z0-9а-яА-ЯёЁ_-]*$/, ' ').trimStart()
    );
    setSlashFilter(null);
    setIsSkillMenuOpen(false);
  };

  const handleInputChangeWithSlashDetection = (val: string) => {
    setInputText(val);
    const match = val.match(/(?:^|\s)\/([a-zA-Z0-9а-яА-ЯёЁ_-]*)$/);
    if (match) {
      setSlashFilter(match[1]);
      setSlashSelectedIndex(0);
    } else {
      setSlashFilter(null);
    }
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAttachedImages((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              setAttachedImages((prev) => [...prev, reader.result as string]);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const submitCurrentInput = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeChat || (!inputText.trim() && attachedImages.length === 0) || isStreaming) {
      return;
    }
    const textToSend = inputText;
    const imagesToSend = attachedImages;
    setInputText('');
    setAttachedImages([]);
    setSlashFilter(null);
    setIsSkillMenuOpen(false);
    await onSendMessage(textToSend, imagesToSend);
  };

  return (
    <div className="px-6 pb-5 pt-2 bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur-md">
      <div className="relative max-w-4xl mx-auto">
        {/* Floating Slash Command / Skills Picker Menu */}
        {(slashFilter !== null || isSkillMenuOpen) && filteredSlashSkills.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl overflow-hidden z-30">
            <div className="px-3.5 py-2 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500">
              <span className="font-medium flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5" />
                <span>{t.composer.slashPickerHeader}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setSlashFilter(null);
                  setIsSkillMenuOpen(false);
                }}
                className="hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
              {filteredSlashSkills.map((sk, idx) => {
                const isHighlighted = idx === slashSelectedIndex;
                return (
                  <button
                    key={sk.id}
                    type="button"
                    onClick={() => handleSelectSkillFromMenu(sk)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-start gap-2.5 transition-colors ${
                      isHighlighted
                        ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                        : 'hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <span className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 font-mono font-semibold text-[11px] text-neutral-900 dark:text-neutral-100 flex-shrink-0">
                      /{sk.slug}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{sk.name}</div>
                      <div className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">
                        {sk.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden transition-colors focus-within:border-neutral-400 dark:focus-within:border-neutral-600">
          {/* Active Selected Skills Chips */}
          {selectedSkills.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-1">
              {selectedSkills.map((sk) => (
                <span
                  key={sk.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/90 dark:border-neutral-700 text-xs font-medium text-neutral-800 dark:text-neutral-200"
                >
                  <Wand2 className="w-3 h-3 text-neutral-500" />
                  <span className="font-mono">/{sk.slug}</span>
                  <span className="text-neutral-500 dark:text-neutral-400">({sk.name})</span>
                  <button
                    type="button"
                    onClick={() =>
                      onSelectedSkillsChange((prev) =>
                        prev.filter((item) => item.id !== sk.id)
                      )
                    }
                    className="p-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Attached Images Preview Strip */}
          {attachedImages.length > 0 && (
            <div className="flex items-center gap-2.5 px-4 pt-3 pb-1 overflow-x-auto">
              {attachedImages.map((img, idx) => (
                <div key={idx} className="relative group flex-shrink-0">
                  <img
                    src={img}
                    alt="preview"
                    className="h-14 w-14 object-cover rounded-xl border border-neutral-300 dark:border-neutral-700"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAttachedImages((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea Input */}
          <form onSubmit={submitCurrentInput}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImagePick}
              className="hidden"
            />

            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => handleInputChangeWithSlashDetection(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (
                  (slashFilter !== null || isSkillMenuOpen) &&
                  filteredSlashSkills.length > 0
                ) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSlashSelectedIndex((prev) => (prev + 1) % filteredSlashSkills.length);
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSlashSelectedIndex(
                      (prev) =>
                        (prev - 1 + filteredSlashSkills.length) % filteredSlashSkills.length
                    );
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    const chosen =
                      filteredSlashSkills[slashSelectedIndex] || filteredSlashSkills[0];
                    if (chosen) {
                      handleSelectSkillFromMenu(chosen);
                    }
                    return;
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setSlashFilter(null);
                    setIsSkillMenuOpen(false);
                    return;
                  }
                }

                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitCurrentInput();
                }
              }}
              placeholder={t.composer.placeholder}
              className="w-full px-4 pt-3.5 pb-2 bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none resize-none"
            />

            {/* Bottom Control Bar inside Composer Box */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/60 dark:bg-neutral-950/40 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {/* Attach Image Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
                  title={t.composer.attachImageTooltip}
                >
                  <ImagePlus className="w-4 h-4" />
                </button>

                {/* Skills Quick Menu Button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSkillMenuOpen(!isSkillMenuOpen);
                    setSlashSelectedIndex(0);
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                    selectedSkills.length > 0 || isSkillMenuOpen
                      ? 'border-neutral-400 dark:border-neutral-600 bg-neutral-200/80 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                      : 'border-neutral-200/80 dark:border-neutral-800 bg-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                  }`}
                  title={t.composer.skillsTooltip}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Skills</span>
                </button>

                {/* MCP Status Pill */}
                <button
                  type="button"
                  onClick={() => onOpenSettings('mcp')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] transition-colors ${
                    connectedMcpServers.length > 0
                      ? 'border-neutral-300 dark:border-neutral-700 bg-neutral-200/60 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                      : 'border-neutral-200/80 dark:border-neutral-800 bg-transparent text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300'
                  }`}
                  title={t.composer.mcpSetupTooltip}
                >
                  <Blocks className="w-3.5 h-3.5" />
                  <span>
                    MCP
                    {connectedMcpServers.length > 0 ? ` (${totalConnectedMcpTools})` : ''}
                  </span>
                </button>

                <div className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-800" />

                {/* Model Selector (Local Ollama + External OpenAI Providers) */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/70">
                  {isExternalModel ? (
                    <Cloud className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                  ) : (
                    <Cpu className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                  )}
                  <select
                    value={currentModelName}
                    onChange={(e) => onModelChange(e.target.value)}
                    className="bg-transparent text-xs font-medium text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer pr-1 max-w-[195px] truncate"
                    title={t.composer.modelSelectorTooltip}
                  >
                    {models.length === 0 && enabledProviders.length === 0 ? (
                      <option value={currentModelName || 'llama3.2'}>
                        {formatModelDisplayName(currentModelName, providers) ||
                          t.composer.noModels}
                      </option>
                    ) : (
                      <>
                        {models.length > 0 && (
                          <optgroup
                            label={t.composer.localModelsGroup}
                            className="bg-white dark:bg-neutral-900"
                          >
                            {models.map((m) => (
                              <option
                                key={m.name}
                                value={m.name}
                                className="bg-white dark:bg-neutral-900"
                              >
                                {m.name} ({formatBytes(m.size)})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {enabledProviders.map((prov) => (
                          <optgroup
                            key={prov.id}
                            label={`${prov.name} (OpenAI API)`}
                            className="bg-white dark:bg-neutral-900"
                          >
                            {prov.models.map((modId) => {
                              const val = makeProviderModelValue(prov.id, modId);
                              return (
                                <option
                                  key={val}
                                  value={val}
                                  className="bg-white dark:bg-neutral-900"
                                >
                                  {prov.name} • {modId}
                                </option>
                              );
                            })}
                          </optgroup>
                        ))}
                      </>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={onRefreshModels}
                    className="p-0.5 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                    title={t.composer.refreshModelsTooltip}
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>

                {/* Model RAM/VRAM Status (for local Ollama) OR Cloud Provider Pill */}
                {isExternalModel ? (
                  <button
                    type="button"
                    onClick={() => onOpenSettings('providers')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-200/70 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-[11px]"
                  >
                    <Cloud className="w-3 h-3" />
                    <span>{t.composer.cloudProviderBadge}</span>
                  </button>
                ) : (
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all ${
                      loadedModelInfo
                        ? 'border-neutral-300 dark:border-neutral-700 bg-neutral-200/70 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                        : 'border-neutral-200/80 dark:border-neutral-800 bg-transparent text-neutral-400 dark:text-neutral-500'
                    }`}
                    title={
                      loadedModelInfo
                        ? `${t.composer.loadedInRamTooltip} ${formatBytes(
                            loadedModelInfo.size_vram || loadedModelInfo.size
                          )}`
                        : t.composer.unloadedFromRamTooltip
                    }
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        loadedModelInfo
                          ? 'bg-neutral-800 dark:bg-neutral-200'
                          : 'bg-neutral-300 dark:bg-neutral-700'
                      }`}
                    />
                    <HardDrive className="w-3 h-3" />
                    {loadedModelInfo ? (
                      <span>
                        <strong>
                          {formatBytes(loadedModelInfo.size_vram || loadedModelInfo.size)}
                        </strong>
                      </span>
                    ) : (
                      <span>{t.composer.notInRam}</span>
                    )}
                    <button
                      type="button"
                      disabled={isTogglingModelMemory || !currentModelName}
                      onClick={onToggleModelMemory}
                      className="ml-0.5 p-0.5 rounded hover:bg-neutral-300/60 dark:hover:bg-neutral-700 transition-colors"
                      title={
                        loadedModelInfo
                          ? t.composer.unloadModelTooltip
                          : t.composer.loadModelTooltip
                      }
                    >
                      <Power className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Compact Context Usage Meter */}
                <div
                  className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] text-neutral-500 dark:text-neutral-400"
                  title={`~${activeTokensApprox} / ${effectiveContextMax} tok (${Math.round(
                    settings.compressionThresholdRatio * 100
                  )}%)`}
                >
                  <Archive className="w-3 h-3" />
                  <span>{contextUsagePercent}%</span>
                  <div className="w-10 h-1 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-neutral-600 dark:bg-neutral-400 transition-all"
                      style={{ width: `${contextUsagePercent}%` }}
                    />
                  </div>
                </div>

                {/* Smoothly Animated Tokens Per Second Gauge */}
                {smoothTokensPerSec !== null && smoothTokensPerSec > 0 && (
                  <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/70 text-[11px] font-mono tabular-nums text-neutral-600 dark:text-neutral-300 transition-all duration-300">
                    <Gauge
                      className={`w-3 h-3 transition-transform duration-500 ${
                        isStreaming
                          ? 'animate-pulse text-neutral-800 dark:text-neutral-100'
                          : 'text-neutral-400'
                      }`}
                    />
                    <span className="min-w-[54px] text-right">
                      {Math.round(smoothTokensPerSec)} {t.composer.tpsShort}
                    </span>
                    <div className="w-10 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                      <div
                        className="h-full bg-neutral-700 dark:bg-neutral-300 transition-all duration-300 ease-out"
                        style={{
                          width: `${Math.min(100, Math.round((smoothTokensPerSec / 80) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Right Controls: Send / Stop Button */}
              <div>
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={onStopGeneration}
                    className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 dark:bg-neutral-200 dark:hover:bg-neutral-300 text-neutral-100 dark:text-neutral-900 font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>{t.composer.stop}</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!inputText.trim() && attachedImages.length === 0}
                    className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 disabled:opacity-35 disabled:pointer-events-none text-neutral-100 dark:text-neutral-900 font-medium text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{t.composer.send}</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
