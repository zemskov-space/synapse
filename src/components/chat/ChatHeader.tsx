import React from 'react';
import {
  Archive,
  Ghost,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  MessageSquare,
  Copy,
  GitBranch,
} from 'lucide-react';
import type { ChatRecord } from '../../types/chat';
import { useI18n } from '../../i18n';

interface ChatHeaderProps {
  activeChat: ChatRecord | null;
  chats: ChatRecord[];
  recentMemoryToast: string | null;
  showSummaryBanner: boolean;
  onToggleSummaryBanner: () => void;
  compressionNotice: string;
  onSelectChat: (chatId: string) => void;
  onDuplicateChat: (chatId: string, e?: React.MouseEvent) => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  activeChat,
  chats,
  recentMemoryToast,
  showSummaryBanner,
  onToggleSummaryBanner,
  compressionNotice,
  onSelectChat,
  onDuplicateChat,
}) => {
  const { t } = useI18n();

  return (
    <>
      <header className="app-drag-region pt-6 pb-3 px-6 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/80 dark:bg-neutral-950/80 backdrop-blur-md flex items-center justify-between gap-3 select-none cursor-default">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          {activeChat?.incognito ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300/80 dark:border-neutral-700"
              title={t.header.incognitoTooltip}
            >
              <Ghost className="w-3.5 h-3.5" />
              <span>{t.header.incognitoBadge}</span>
            </span>
          ) : (
            <MessageSquare className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          )}
          <h2 className="text-sm font-semibold truncate text-neutral-800 dark:text-neutral-100 max-w-xs">
            {activeChat?.title || t.header.selectOrCreateChat}
          </h2>

          {activeChat?.parentChatId && (
            <button
              type="button"
              onClick={() => {
                const parentExists = chats.some((c) => c.id === activeChat.parentChatId);
                if (parentExists && activeChat.parentChatId) {
                  onSelectChat(activeChat.parentChatId);
                }
              }}
              className="app-no-drag inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-neutral-200/70 hover:bg-neutral-300/70 dark:bg-neutral-800/90 dark:hover:bg-neutral-700/80 text-neutral-600 dark:text-neutral-300 border border-neutral-300/60 dark:border-neutral-700/70 transition-colors"
              title={t.header.parentChatTooltip}
            >
              <GitBranch className="w-3 h-3 text-neutral-500" />
              <span className="truncate max-w-[180px]">
                {t.header.fromChat} {activeChat.parentChatTitle || t.header.parentChatDefault}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {recentMemoryToast && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-200/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs animate-pulse">
              <BrainCircuit className="w-3.5 h-3.5" />
              <span className="truncate max-w-xs">{recentMemoryToast}</span>
            </div>
          )}

          {activeChat && (
            <button
              type="button"
              onClick={(e) => onDuplicateChat(activeChat.id, e)}
              className="app-no-drag inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/80 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 transition-colors"
              title={t.header.duplicateChatTooltip}
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.header.duplicateChat}</span>
            </button>
          )}
        </div>
      </header>

      {activeChat?.compressedSummary && (
        <div className="px-6 py-2 bg-neutral-200/50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs">
          <button
            type="button"
            onClick={onToggleSummaryBanner}
            className="w-full flex items-center justify-between font-medium text-neutral-700 dark:text-neutral-300"
          >
            <div className="flex items-center gap-2">
              <Archive className="w-3.5 h-3.5 text-neutral-500" />
              <span>{t.header.compressedSummaryTitle}</span>
            </div>
            <div className="flex items-center gap-1 text-neutral-500">
              <span>{showSummaryBanner ? t.header.hideSummary : t.header.showSummary}</span>
              {showSummaryBanner ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </div>
          </button>
          {showSummaryBanner && (
            <div className="mt-2 p-3 rounded-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {activeChat.compressedSummary}
            </div>
          )}
        </div>
      )}

      {compressionNotice && (
        <div className="px-6 py-2 bg-neutral-200/70 dark:bg-neutral-900 border-b border-neutral-300 dark:border-neutral-800 text-xs text-neutral-700 dark:text-neutral-300 flex items-center gap-2 animate-pulse">
          <Archive className="w-3.5 h-3.5" />
          <span>{compressionNotice}</span>
        </div>
      )}
    </>
  );
};
