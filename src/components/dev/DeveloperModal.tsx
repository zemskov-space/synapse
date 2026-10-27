import React, { useEffect, useState } from 'react';
import {
  X,
  Database,
  Terminal,
  Activity,
  FolderOpen,
  Code,
} from 'lucide-react';
import { DbTablesInspectorTab } from './DbTablesInspectorTab';
import { SqlConsoleTab } from './SqlConsoleTab';
import { DiagnosticsTab } from './DiagnosticsTab';
import { useI18n } from '../../i18n';

export type DevModalTabId = 'tables' | 'sql' | 'diagnostics';

interface DeveloperModalProps {
  isOpen: boolean;
  initialTab?: DevModalTabId;
  onClose: () => void;
  onDatabaseMutated: () => void;
}

export const DeveloperModal: React.FC<DeveloperModalProps> = ({
  isOpen,
  initialTab = 'tables',
  onClose,
  onDatabaseMutated,
}) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<DevModalTabId>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl h-[86vh] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t.dev.modalTitle}
              </h2>
              <p className="text-[11px] text-neutral-500">
                {t.dev.modalSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.electronAPI.devShowDbInFolder()}
              className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1.5"
              title={t.dev.dbFileBtnTooltip}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.dev.dbFileBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => window.electronAPI.devToggleDevTools()}
              className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-1.5"
              title={t.dev.devToolsBtnTooltip}
            >
              <Code className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.dev.devToolsBtn}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 px-5 bg-neutral-50/40 dark:bg-neutral-950/30 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('tables')}
            className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'tables'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>{t.dev.tabs.tables}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'sql'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{t.dev.tabs.sql}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{t.dev.tabs.diagnostics}</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'tables' && (
            <DbTablesInspectorTab onDatabaseMutated={onDatabaseMutated} />
          )}
          {activeTab === 'sql' && (
            <SqlConsoleTab onDatabaseMutated={onDatabaseMutated} />
          )}
          {activeTab === 'diagnostics' && (
            <DiagnosticsTab onDatabaseMutated={onDatabaseMutated} />
          )}
        </div>
      </div>
    </div>
  );
};
