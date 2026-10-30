import React, { useEffect, useState } from 'react';
import {
  Globe,
  Sun,
  Moon,
  Monitor,
  Server,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Cpu,
  Bell,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Volume2,
} from 'lucide-react';
import appIcon from '../../../assets/icons/ui-icon.png';
import type { AppSettings, LanguageCode, OllamaModelInfo } from '../../types/chat';
import { SUPPORTED_LANGUAGES, useI18n } from '../../i18n';
import { formatBytes } from '../../utils/formatters';

interface OnboardingModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onLivePreviewChange: (partial: Partial<AppSettings>) => void;
  onCompleteOnboarding: (finalSettings: Partial<AppSettings>, models: OllamaModelInfo[]) => Promise<void>;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  settings,
  onLivePreviewChange,
  onCompleteOnboarding,
}) => {
  const { t } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [language, setLanguage] = useState<LanguageCode>(settings.language || 'ru');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(settings.theme || 'system');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(settings.soundEnabled === true);
  const [ollamaHost, setOllamaHost] = useState<string>(
    settings.ollamaHost || 'http://127.0.0.1:11434'
  );
  const [ollamaApiKey, setOllamaApiKey] = useState<string>(settings.ollamaApiKey || '');

  const [isCheckingOllama, setIsCheckingOllama] = useState<boolean>(false);
  const [ollamaConnected, setOllamaConnected] = useState<boolean>(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<OllamaModelInfo[]>([]);

  const [defaultModel, setDefaultModel] = useState<string>(settings.defaultModel || '');
  const [enableNotifications, setEnableNotifications] = useState<boolean>(
    settings.enableNotifications !== false
  );
  const [isFinishing, setIsFinishing] = useState<boolean>(false);

  const checkOllamaConnection = async (hostToTest = ollamaHost, keyToTest = ollamaApiKey) => {
    setIsCheckingOllama(true);
    setOllamaError(null);
    try {
      const cleanHost = hostToTest.trim() || 'http://127.0.0.1:11434';
      const res = await window.electronAPI.listModels({
        host: cleanHost,
        apiKey: keyToTest.trim(),
      });
      if (res.ok) {
        setOllamaConnected(true);
        const list = res.models || [];
        setDiscoveredModels(list);
        if (list.length > 0 && (!defaultModel || !list.some((m) => m.name === defaultModel))) {
          setDefaultModel(list[0].name);
        }
      } else {
        setOllamaConnected(false);
        setDiscoveredModels([]);
        setOllamaError(res.error || 'Connection failed');
      }
    } catch (err: unknown) {
      setOllamaConnected(false);
      setDiscoveredModels([]);
      setOllamaError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsCheckingOllama(false);
    }
  };

  useEffect(() => {
    if (isOpen && step === 2) {
      checkOllamaConnection(ollamaHost, ollamaApiKey);
    }
  }, [isOpen, step]);

  if (!isOpen) return null;

  const handleSelectLanguage = (code: LanguageCode) => {
    setLanguage(code);
    onLivePreviewChange({ language: code });
  };

  const handleSelectTheme = (nextTheme: 'system' | 'light' | 'dark') => {
    setTheme(nextTheme);
    onLivePreviewChange({ theme: nextTheme });
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      const chosenModel = defaultModel || discoveredModels[0]?.name || 'llama3.2';
      await onCompleteOnboarding(
        {
          language,
          theme,
          soundEnabled,
          ollamaHost: ollamaHost.trim() || 'http://127.0.0.1:11434',
          ollamaApiKey: ollamaApiKey.trim(),
          defaultModel: chosenModel,
          enableNotifications,
          onboardingCompleted: true,
        },
        discoveredModels
      );
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/75 backdrop-blur-md p-4 select-none">
      <div className="w-full max-w-2xl rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Top Hero Banner */}
        <div className="px-7 pt-7 pb-5 border-b border-neutral-200/80 dark:border-neutral-800 bg-gradient-to-b from-neutral-100/80 to-white dark:from-neutral-950/80 dark:to-neutral-900">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src={appIcon}
                alt="Synapse"
                className="w-12 h-12 rounded-2xl object-cover shadow-md flex-shrink-0"
              />
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-200/80 dark:bg-neutral-800 text-[10px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300 mb-1">
                  <Sparkles className="w-3 h-3" />
                  <span>{t.onboarding.welcomeBadge}</span>
                </div>
                <h1 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                  {t.onboarding.title}
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t.onboarding.subtitle}
                </p>
              </div>
            </div>

            {/* Step Progress Dots */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((num) => (
                <div
                  key={num}
                  className={`h-2 rounded-full transition-all ${
                    step === num
                      ? 'w-7 bg-neutral-900 dark:bg-neutral-100'
                      : step > num
                        ? 'w-2 bg-neutral-500 dark:bg-neutral-400'
                        : 'w-2 bg-neutral-200 dark:bg-neutral-800'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Step Body */}
        <div className="p-7 space-y-5 text-xs flex-1 overflow-y-auto max-h-[65vh]">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  1. {t.onboarding.step1Title}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t.onboarding.step1Desc}
                </p>
              </div>

              {/* Language Picker */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
                  <Globe className="w-3.5 h-3.5 text-neutral-500" />
                  <span>{t.settings.general.languageLabel}</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const active = language === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleSelectLanguage(lang.code)}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                          active
                            ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                            : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-sm">{lang.nativeName}</div>
                          <div
                            className={`text-[11px] ${
                              active
                                ? 'text-neutral-300 dark:text-neutral-600'
                                : 'text-neutral-400 dark:text-neutral-500'
                            }`}
                          >
                            {lang.name}
                          </div>
                        </div>
                        {active && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Theme Picker */}
              <div className="space-y-2">
                <label className="block font-medium text-neutral-700 dark:text-neutral-300">
                  {t.settings.general.themeLabel}
                </label>
                <div className="grid grid-cols-3 gap-3">
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
                        onClick={() => handleSelectTheme(item.id)}
                        className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-2xl border font-medium transition-all ${
                          active
                            ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                            : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 flex items-center justify-between gap-4 cursor-pointer">
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
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="w-4 h-4 accent-neutral-800 dark:accent-neutral-200 cursor-pointer"
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  2. {t.onboarding.step2Title}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t.onboarding.step2Desc}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    <Server className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{t.onboarding.ollamaUrlLabel}</span>
                  </label>
                  <input
                    type="text"
                    value={ollamaHost}
                    onChange={(e) => {
                      setOllamaHost(e.target.value);
                      setOllamaConnected(false);
                    }}
                    placeholder="http://127.0.0.1:11434"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-mono focus:outline-none focus:border-neutral-500"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    <KeyRound className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{t.onboarding.ollamaApiKeyLabel}</span>
                  </label>
                  <input
                    type="password"
                    value={ollamaApiKey}
                    onChange={(e) => {
                      setOllamaApiKey(e.target.value);
                      setOllamaConnected(false);
                    }}
                    placeholder={t.settings.general.ollamaApiKeyPlaceholder}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-mono focus:outline-none focus:border-neutral-500"
                  />
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
                    {t.onboarding.ollamaApiKeyHint}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isCheckingOllama}
                    onClick={() => checkOllamaConnection(ollamaHost, ollamaApiKey)}
                    className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 font-medium inline-flex items-center gap-2 transition-all"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isCheckingOllama ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {isCheckingOllama
                        ? t.onboarding.checkingConnection
                        : t.onboarding.checkConnectionBtn}
                    </span>
                  </button>
                </div>
              </div>

              {/* Connection Status Box */}
              {ollamaConnected ? (
                <div className="p-4 rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-800/60 space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
                    <CheckCircle2 className="w-4 h-4 text-neutral-800 dark:text-neutral-200 flex-shrink-0" />
                    <span>{t.onboarding.statusConnected}</span>
                  </div>
                  <div className="text-neutral-600 dark:text-neutral-300">
                    {t.onboarding.modelsFound} <strong>{discoveredModels.length}</strong>
                  </div>
                  {discoveredModels.length === 0 && (
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 pt-1 font-mono">
                      {t.onboarding.noModelsWarning}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100/70 dark:bg-neutral-950/80 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-neutral-700 dark:text-neutral-300 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {t.onboarding.statusOfflineTitle}
                      </div>
                      <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {t.onboarding.statusOfflineDesc}
                      </p>
                      {ollamaError && (
                        <div className="text-[11px] font-mono text-neutral-500 pt-0.5">
                          ({ollamaError})
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      window.electronAPI.openExternalUrl('https://ollama.com/download')
                    }
                    className="w-full py-2.5 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium inline-flex items-center justify-center gap-2 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t.onboarding.downloadOllamaBtn}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  3. {t.onboarding.step3Title}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t.onboarding.step3Desc}
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
                  <Cpu className="w-3.5 h-3.5 text-neutral-500" />
                  <span>{t.onboarding.selectDefaultModelLabel}</span>
                </label>

                {discoveredModels.length === 0 ? (
                  <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-500">
                    {t.onboarding.noModelsWarning}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                    {discoveredModels.map((m) => {
                      const active = defaultModel === m.name;
                      return (
                        <button
                          key={m.name}
                          type="button"
                          onClick={() => setDefaultModel(m.name)}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                            active
                              ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                              : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-mono font-semibold truncate">{m.name}</div>
                            <div
                              className={`text-[11px] ${
                                active
                                  ? 'text-neutral-300 dark:text-neutral-600'
                                  : 'text-neutral-400 dark:text-neutral-500'
                              }`}
                            >
                              {formatBytes(m.size)}
                              {m.details?.parameter_size ? ` • ${m.details.parameter_size}` : ''}
                            </div>
                          </div>
                          {active && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 flex items-center justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  <Bell className="w-4 h-4 text-neutral-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">
                      {t.onboarding.enableNotificationsLabel}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {t.onboarding.enableNotificationsDesc}
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={enableNotifications}
                  onChange={(e) => setEnableNotifications(e.target.checked)}
                  className="w-4 h-4 accent-neutral-800 dark:accent-neutral-200 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-7 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 text-xs">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev === 3 ? 2 : 1))}
                className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1.5 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t.common.back}</span>
              </button>
            )}
          </div>

          <div>
            {step === 1 && (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span>{t.common.next}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                disabled={!ollamaConnected || isCheckingOllama}
                onClick={() => setStep(3)}
                className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 disabled:opacity-35 disabled:pointer-events-none text-neutral-100 dark:text-neutral-900 font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span>{t.common.next}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                disabled={isFinishing}
                onClick={handleFinish}
                className="px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span>{t.onboarding.finishBtn}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
