import React, { useEffect, useState } from 'react';
import {
  HardDrive,
  FolderOpen,
  Sparkles,
  Ghost,
  Trash2,
  RefreshCw,
  Cpu,
  Terminal,
} from 'lucide-react';
import type { DevDiagnosticsInfo } from '../../types/chat';
import { formatBytes } from '../../utils/formatters';
import { useI18n } from '../../i18n';

interface DiagnosticsTabProps {
  onDatabaseMutated: () => void;
}

export const DiagnosticsTab: React.FC<DiagnosticsTabProps> = ({ onDatabaseMutated }) => {
  const { t, language } = useI18n();
  const [diag, setDiag] = useState<DevDiagnosticsInfo | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadDiagnostics = async () => {
    const info = await window.electronAPI.devGetDiagnostics();
    setDiag(info);
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const showToast = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const handleVacuum = async () => {
    const res = await window.electronAPI.devVacuumDb();
    if (res.ok) {
      showToast(`${t.dev.diagnosticsTab.vacuumSuccessPrefix} ${formatBytes(res.sizeBytes)}`);
      await loadDiagnostics();
    }
  };

  const handleClearCaches = async () => {
    await window.electronAPI.devClearCaches();
    showToast(t.dev.diagnosticsTab.cachesClearedToast);
    await loadDiagnostics();
  };

  const handleClearIncognito = async () => {
    await window.electronAPI.devClearIncognito();
    showToast(t.dev.diagnosticsTab.incognitoClearedToast);
    await loadDiagnostics();
    onDatabaseMutated();
  };

  if (!diag) {
    return (
      <div className="p-8 text-center text-xs text-neutral-400">
        {t.dev.diagnosticsTab.loading}
      </div>
    );
  }

  return (
    <div className="p-5 overflow-y-auto h-full space-y-5 text-xs">
      {statusMsg && (
        <div className="px-4 py-2.5 rounded-xl bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 font-medium">
          {statusMsg}
        </div>
      )}

      {/* SQLite File & Storage Card */}
      <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
            <HardDrive className="w-4 h-4 text-neutral-500" />
            <span>{t.dev.diagnosticsTab.sqliteCardTitle}</span>
          </div>
          <button
            type="button"
            onClick={loadDiagnostics}
            className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500"
            title={t.dev.diagnosticsTab.refreshTooltip}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800">
            <div className="text-[11px] text-neutral-400">{t.dev.diagnosticsTab.sizeOnDisk}</div>
            <div className="text-sm font-semibold mt-0.5">
              {formatBytes(diag.dbFileSizeBytes)} (
              {diag.dbFileSizeBytes.toLocaleString(language === 'en' ? 'en-US' : 'ru-RU')}{' '}
              {language === 'en' ? 'B' : 'Б'})
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800">
            <div className="text-[11px] text-neutral-400">
              {t.dev.diagnosticsTab.tablesInSchema}
            </div>
            <div className="text-sm font-semibold mt-0.5">{diag.tableCount}</div>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800">
            <div className="text-[11px] text-neutral-400">
              {t.dev.diagnosticsTab.storageEngine}
            </div>
            <div className="text-sm font-semibold mt-0.5">SQLite WASM + Disk Sync</div>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 font-mono text-[11px] text-neutral-600 dark:text-neutral-300 break-all">
          {diag.dbFilePath}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.electronAPI.devShowDbInFolder()}
            className="px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium inline-flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{t.dev.diagnosticsTab.showInFinderBtn}</span>
          </button>

          <button
            type="button"
            onClick={handleVacuum}
            className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 font-medium inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.dev.diagnosticsTab.vacuumBtn}</span>
          </button>
        </div>
      </div>

      {/* RAM Incognito Store Inspector */}
      <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
            <Ghost className="w-4 h-4 text-neutral-500" />
            <span>
              {t.dev.diagnosticsTab.incognitoCardTitle} ({t.dev.diagnosticsTab.chatsLabel}{' '}
              {diag.incognitoChatsCount}, {t.dev.diagnosticsTab.messagesLabel}{' '}
              {diag.incognitoMessagesCount})
            </span>
          </div>
          {diag.incognitoChatsCount > 0 && (
            <button
              type="button"
              onClick={handleClearIncognito}
              className="px-2.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-[11px] inline-flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>{t.dev.diagnosticsTab.clearIncognitoBtn}</span>
            </button>
          )}
        </div>

        {diag.incognitoChats.length === 0 ? (
          <div className="text-neutral-400">{t.dev.diagnosticsTab.noIncognitoChats}</div>
        ) : (
          <div className="space-y-1.5">
            {diag.incognitoChats.map((c) => (
              <div
                key={c.id}
                className="p-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between font-mono text-[11px]"
              >
                <div className="truncate">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {c.title}
                  </span>{' '}
                  <span className="text-neutral-400">({c.id.slice(0, 8)}…)</span>
                </div>
                <div className="flex items-center gap-3 text-neutral-500">
                  <span>{c.model}</span>
                  <span>
                    {c.messageCount} {t.dev.diagnosticsTab.messagesShort}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ollama Caches & Runtime Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-neutral-500" />
              <span>{t.dev.diagnosticsTab.ollamaCacheTitle}</span>
            </span>
            <button
              type="button"
              onClick={handleClearCaches}
              className="text-[11px] underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              {t.dev.diagnosticsTab.resetCachesBtn}
            </button>
          </div>

          {diag.modelContextCache.length === 0 ? (
            <div className="text-neutral-400">{t.dev.diagnosticsTab.cacheEmpty}</div>
          ) : (
            <div className="space-y-1 font-mono text-[11px]">
              {diag.modelContextCache.map((item) => (
                <div
                  key={item.model}
                  className="flex justify-between p-2 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800"
                >
                  <span>{item.model}</span>
                  <span>
                    {item.contextLength} {t.dev.diagnosticsTab.tokensUnit}
                  </span>
                </div>
              ))}
            </div>
          )}

          {diag.disabledToolsModels.length > 0 && (
            <div className="pt-2">
              <div className="text-[11px] text-neutral-500 mb-1">
                {t.dev.diagnosticsTab.fallbackModelsLabel}
              </div>
              <div className="font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                {diag.disabledToolsModels.join(', ')}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-neutral-500" />
              <span>{t.dev.diagnosticsTab.runtimeTitle}</span>
            </span>
            <button
              type="button"
              onClick={() => window.electronAPI.devToggleDevTools()}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 font-medium text-[11px]"
            >
              {t.dev.diagnosticsTab.openDevToolsBtn}
            </button>
          </div>

          <div className="space-y-1.5 font-mono text-[11px] text-neutral-600 dark:text-neutral-300">
            <div className="flex justify-between">
              <span className="text-neutral-400">{t.dev.diagnosticsTab.platformLabel}</span>
              <span>
                {diag.versions.platform} ({diag.versions.arch})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Electron:</span>
              <span>v{diag.versions.electron}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Chromium:</span>
              <span>v{diag.versions.chrome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Node.js:</span>
              <span>v{diag.versions.node}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
