import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n';

interface ThinkingBlockProps {
  thinkingText: string;
  isStreamingThinking?: boolean;
  customStreamingLabel?: string;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  thinkingText,
  isStreamingThinking = false,
  customStreamingLabel,
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState<boolean>(false);

  if (!thinkingText && !isStreamingThinking) return null;

  const isWaitingForFirstToken = isStreamingThinking && !thinkingText;

  return (
    <div className="mb-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-900/60 overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            {isWaitingForFirstToken ? (
              <Loader2 className="w-4 h-4 text-neutral-600 dark:text-neutral-400 animate-spin" />
            ) : (
              <Brain
                className={`w-4 h-4 text-neutral-600 dark:text-neutral-400 ${
                  isStreamingThinking ? 'animate-pulse' : ''
                }`}
              />
            )}
            {isStreamingThinking && !isWaitingForFirstToken && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-600 dark:bg-neutral-300"></span>
              </span>
            )}
          </div>

          {isStreamingThinking ? (
            <span className="inline-flex items-center gap-1.5 font-medium bg-gradient-to-r from-neutral-800 via-neutral-400 to-neutral-800 dark:from-neutral-200 dark:via-neutral-500 dark:to-neutral-200 bg-[length:200%_100%] animate-shimmer bg-clip-text text-transparent">
              <span>{customStreamingLabel || t.thinking.modelThinking}</span>
            </span>
          ) : (
            <span>
              {t.thinking.thinkingStats} ({Math.max(1, Math.ceil(thinkingText.length / 4))}{' '}
              {t.thinking.tokensShort})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
          <span>{isOpen ? t.thinking.hideThoughts : t.thinking.showThoughts}</span>
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-3.5 py-2.5 border-t border-neutral-200/80 dark:border-neutral-800 bg-white/60 dark:bg-neutral-950/50 text-xs text-neutral-600 dark:text-neutral-400 font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
          {thinkingText || customStreamingLabel || t.thinking.buildingReasoning}
        </div>
      )}
    </div>
  );
};
