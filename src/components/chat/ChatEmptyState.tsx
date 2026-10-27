import React from 'react';
import { Ghost } from 'lucide-react';
import appIcon from '../../../assets/icons/ui-icon.png';
import type { ChatRecord } from '../../types/chat';
import { useI18n } from '../../i18n';

interface ChatEmptyStateProps {
  activeChat: ChatRecord | null;
  onQuickPrompt: (prompt: string) => void;
}

export const ChatEmptyState: React.FC<ChatEmptyStateProps> = ({ activeChat, onQuickPrompt }) => {
  const { t } = useI18n();

  return (
    <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
      {activeChat?.incognito ? (
        <div className="w-12 h-12 rounded-2xl bg-neutral-200/70 dark:bg-neutral-900 border border-neutral-300/70 dark:border-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 mb-4">
          <Ghost className="w-6 h-6" />
        </div>
      ) : (
        <img
          src={appIcon}
          alt="Synapse"
          className="w-12 h-12 rounded-2xl object-cover shadow-sm mb-4"
        />
      )}
      <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-100 mb-1.5">
        {activeChat?.incognito ? t.emptyState.incognitoTitle : t.emptyState.normalTitle}
      </h3>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-5">
        {t.emptyState.description}
      </p>

      {/* Quick Starter Prompts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left text-xs">
        <button
          type="button"
          onClick={() => onQuickPrompt(t.emptyState.card1Prompt)}
          className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-400 dark:hover:border-neutral-600 transition-all"
        >
          <div className="font-medium text-neutral-800 dark:text-neutral-200 mb-0.5">
            {t.emptyState.card1Title}
          </div>
          <div className="text-neutral-500 dark:text-neutral-400 text-[11px]">
            {t.emptyState.card1Desc}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onQuickPrompt(t.emptyState.card2Prompt)}
          className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-400 dark:hover:border-neutral-600 transition-all"
        >
          <div className="font-medium text-neutral-800 dark:text-neutral-200 mb-0.5">
            {t.emptyState.card2Title}
          </div>
          <div className="text-neutral-500 dark:text-neutral-400 text-[11px]">
            {t.emptyState.card2Desc}
          </div>
        </button>
      </div>
    </div>
  );
};
