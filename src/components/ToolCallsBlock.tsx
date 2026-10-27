import React, { useState } from 'react';
import {
  Wrench,
  Globe,
  FileText,
  BrainCircuit,
  Edit3,
  ChevronDown,
  ChevronRight,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { ToolExecutionTrace } from '../types/chat';
import { useI18n } from '../i18n';
import type { TranslationDictionary } from '../i18n/locales/ru';

interface ToolCallsBlockProps {
  toolCalls: ToolExecutionTrace[];
}

function getToolLabel(
  name: string,
  t: TranslationDictionary
): { label: string; icon: React.FC<{ className?: string }> } {
  switch (name) {
    case 'rename_chat':
      return { label: t.tools.renameChat, icon: Edit3 };
    case 'memory_add':
      return { label: t.tools.memoryAdd, icon: BrainCircuit };
    case 'memory_update':
      return { label: t.tools.memoryUpdate, icon: BrainCircuit };
    case 'memory_delete':
      return { label: t.tools.memoryDelete, icon: BrainCircuit };
    case 'web_search':
      return { label: t.tools.webSearch, icon: Globe };
    case 'fetch_web_page':
      return { label: t.tools.fetchWebPage, icon: FileText };
    default: {
      if (name.startsWith('mcp__')) {
        const clean = name.replace(/^mcp__[a-zA-Z0-9_-]{8}__/, '');
        return { label: `${t.tools.mcpTool} (${clean})`, icon: Wrench };
      }
      return { label: `${t.tools.functionCall} (${name})`, icon: Wrench };
    }
  }
}

function deepUnwrapJsonStrings(val: unknown): unknown {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return deepUnwrapJsonStrings(parsed);
      } catch {
        // Not valid JSON, keep as string
      }
    }
    return val.replace(/&nbsp;/g, ' ');
  }
  if (Array.isArray(val)) {
    return val.map(deepUnwrapJsonStrings);
  }
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = deepUnwrapJsonStrings(v);
    }
    return out;
  }
  return val;
}

function formatToolResultForDisplay(rawResult: string): string {
  if (!rawResult) return '';
  try {
    const parsed = JSON.parse(rawResult);
    const unwrapped = deepUnwrapJsonStrings(parsed);
    return JSON.stringify(unwrapped, null, 2);
  } catch {
    return rawResult.replace(/&nbsp;/g, ' ');
  }
}

export const ToolCallsBlock: React.FC<ToolCallsBlockProps> = ({ toolCalls }) => {
  const { t } = useI18n();
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  if (!toolCalls || toolCalls.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="mb-3 space-y-1.5">
      {toolCalls.map((tc) => {
        const isExpanded = Boolean(expandedIds[tc.id]);
        const { label, icon: Icon } = getToolLabel(tc.name, t);

        return (
          <div
            key={tc.id}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100/60 dark:bg-neutral-900/50 overflow-hidden text-xs"
          >
            <button
              type="button"
              onClick={() => toggleExpand(tc.id)}
              className="w-full flex items-center justify-between px-3 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                <span className="font-medium truncate">{label}</span>
                {tc.args && Object.keys(tc.args).length > 0 && (
                  <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-mono truncate max-w-[240px]">
                    {JSON.stringify(tc.args)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                {tc.status === 'running' && (
                  <span className="inline-flex items-center gap-1 text-neutral-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.tools.running}</span>
                  </span>
                )}
                {tc.status === 'done' && (
                  <Check className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
                )}
                {tc.status === 'error' && (
                  <AlertCircle className="w-3.5 h-3.5 text-neutral-500" />
                )}
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="px-3 py-2.5 border-t border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/60 font-mono text-[11px] space-y-2 text-neutral-600 dark:text-neutral-400">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-0.5">
                    {t.tools.callArgs}
                  </div>
                  <pre className="whitespace-pre-wrap break-words bg-neutral-100 dark:bg-neutral-900 p-2 rounded-lg">
                    {JSON.stringify(deepUnwrapJsonStrings(tc.args), null, 2)}
                  </pre>
                </div>
                {tc.result && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-400 mb-0.5">
                      {t.tools.callResult}
                    </div>
                    <pre className="whitespace-pre-wrap break-words bg-neutral-100 dark:bg-neutral-900 p-2 rounded-lg max-h-72 overflow-y-auto">
                      {formatToolResultForDisplay(tc.result)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
