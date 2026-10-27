import React, { useState } from 'react';
import { Play, Terminal, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import type { SqlQueryExecutionResult } from '../../types/chat';
import { useI18n } from '../../i18n';

interface SqlConsoleTabProps {
  onDatabaseMutated: () => void;
}

const DEFAULT_SQL = 'SELECT id, title, model, context_limit, updated_at FROM chats ORDER BY updated_at DESC;';

export const SqlConsoleTab: React.FC<SqlConsoleTabProps> = ({ onDatabaseMutated }) => {
  const { t } = useI18n();
  const [sqlText, setSqlText] = useState<string>(DEFAULT_SQL);
  const [result, setResult] = useState<SqlQueryExecutionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const presetQueries: Array<{ label: string; sql: string }> = [
    {
      label: t.dev.sqlTab.presetAllChats,
      sql: DEFAULT_SQL,
    },
    {
      label: t.dev.sqlTab.presetRecentMessages,
      sql: 'SELECT id, chat_id, role, substr(content, 1, 100) AS snippet, formatted_time, is_compressed FROM messages ORDER BY timestamp DESC LIMIT 25;',
    },
    {
      label: t.dev.sqlTab.presetMemories,
      sql: 'SELECT * FROM user_memories ORDER BY updated_at DESC;',
    },
    {
      label: t.dev.sqlTab.presetSettings,
      sql: 'SELECT * FROM settings;',
    },
    {
      label: t.dev.sqlTab.presetChatStats,
      sql: `SELECT c.title, c.model, COUNT(m.id) AS messages_count, SUM(LENGTH(m.content)) AS total_chars
FROM chats c
LEFT JOIN messages m ON m.chat_id = c.id
GROUP BY c.id
ORDER BY messages_count DESC;`,
    },
    {
      label: t.dev.sqlTab.presetSchema,
      sql: "SELECT name, type, sql FROM sqlite_master WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%';",
    },
  ];

  const runQuery = async (queryToRun = sqlText) => {
    if (!queryToRun.trim() || isRunning) return;
    setIsRunning(true);
    try {
      const res = await window.electronAPI.devExecuteSql(queryToRun);
      setResult(res);
      if (res.ok && res.rowsModified > 0) {
        onDatabaseMutated();
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3">
      {/* Preset Queries Bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-neutral-500 mr-1">
          {t.dev.sqlTab.presetsLabel}
        </span>
        {presetQueries.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setSqlText(preset.sql);
              runQuery(preset.sql);
            }}
            className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 hover:bg-neutral-200/70 dark:bg-neutral-950 dark:hover:bg-neutral-800 text-[11px] text-neutral-700 dark:text-neutral-300 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* SQL Editor Box */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 overflow-hidden flex flex-col">
        <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500">
          <span className="font-mono flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" />
            <span>{t.dev.sqlTab.editorHeader}</span>
          </span>
          <button
            type="button"
            disabled={isRunning || !sqlText.trim()}
            onClick={() => runQuery(sqlText)}
            className="px-3 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 font-medium text-xs inline-flex items-center gap-1.5"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{t.dev.sqlTab.runSqlBtn}</span>
          </button>
        </div>

        <textarea
          rows={4}
          value={sqlText}
          onChange={(e) => setSqlText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              runQuery(sqlText);
            }
          }}
          placeholder="SELECT * FROM chats..."
          className="w-full p-3 bg-transparent font-mono text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none resize-y"
        />
      </div>

      {/* Execution Status Bar */}
      {result && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 text-xs">
          {result.ok ? (
            <div className="flex items-center gap-3 text-neutral-700 dark:text-neutral-300">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
                <span>{t.dev.sqlTab.queryExecuted}</span>
              </span>
              <span className="text-neutral-400">•</span>
              <span>
                {t.dev.sqlTab.rowsModified} <strong>{result.rowsModified}</strong>
              </span>
              {result.resultSets.length > 0 && (
                <>
                  <span className="text-neutral-400">•</span>
                  <span>
                    {t.dev.sqlTab.rowsReturned} <strong>{result.resultSets[0].rows.length}</strong>
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200 font-mono">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>
                {t.dev.sqlTab.sqlErrorPrefix} {result.error}
              </span>
            </div>
          )}

          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-500">
            <Clock className="w-3 h-3" />
            <span>
              {result.durationMs} {t.dev.sqlTab.msUnit}
            </span>
          </span>
        </div>
      )}

      {/* Results Area */}
      <div className="flex-1 overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        {!result ? (
          <div className="h-full flex items-center justify-center text-xs text-neutral-400">
            {t.dev.sqlTab.emptyPrompt}
          </div>
        ) : !result.ok ? (
          <div className="p-6 text-xs font-mono text-neutral-600 dark:text-neutral-400">
            {result.error}
          </div>
        ) : result.resultSets.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-neutral-500">
            {t.dev.sqlTab.emptyResultSet} {result.rowsModified}).
          </div>
        ) : (
          <div className="space-y-6">
            {result.resultSets.map((rs, setIdx) => (
              <div key={setIdx} className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      {rs.columns.map((col) => (
                        <th
                          key={col}
                          className="py-2 px-3 font-mono font-semibold text-neutral-700 dark:text-neutral-300 border-r border-neutral-200/70 dark:border-neutral-800 last:border-r-0"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                    {rs.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-950/60"
                      >
                        {rs.columns.map((col) => {
                          const val = row[col];
                          const str = val === null || val === undefined ? 'NULL' : String(val);
                          return (
                            <td
                              key={col}
                              className="py-2 px-3 font-mono text-[11px] max-w-md truncate border-r border-neutral-100 dark:border-neutral-800/60 last:border-r-0 text-neutral-800 dark:text-neutral-200"
                              title={str}
                            >
                              {val === null || val === undefined ? (
                                <span className="text-neutral-400 italic">NULL</span>
                              ) : (
                                str
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
