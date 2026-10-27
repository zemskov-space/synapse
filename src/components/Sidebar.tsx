import React from 'react';
import {
  MessageSquarePlus,
  Ghost,
  Search,
  Trash2,
  Settings,
  Database,
  Clock,
  BrainCircuit,
  Copy,
  GitBranch,
  Blocks,
  Wand2,
} from 'lucide-react';
import appIcon from '../../assets/icons/ui-icon.png';
import type { AiProviderConfig, ChatRecord } from '../types/chat';
import type { SettingsTabId } from './SettingsModal';
import { useI18n } from '../i18n';
import { formatModelDisplayName } from '../utils/formatters';

interface SidebarProps {
  chats: ChatRecord[];
  activeChatId: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectChat: (chatId: string) => void;
  onCreateChat: (incognito: boolean) => void;
  onDuplicateChat: (chatId: string, e: React.MouseEvent) => void;
  onDeleteChat: (chatId: string, e: React.MouseEvent) => void;
  onOpenSettings: (tab?: SettingsTabId) => void;
  ollamaOnline: boolean;
  memoryCount: number;
  connectedMcpCount: number;
  skillsCount: number;
  providers: AiProviderConfig[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChatId,
  searchQuery,
  onSearchChange,
  onSelectChat,
  onCreateChat,
  onDuplicateChat,
  onDeleteChat,
  onOpenSettings,
  ollamaOnline,
  memoryCount,
  connectedMcpCount,
  skillsCount,
  providers,
}) => {
  const { t } = useI18n();

  return (
    <aside className="w-72 flex-shrink-0 h-full flex flex-col border-r border-neutral-200 dark:border-neutral-800/90 bg-neutral-100/80 dark:bg-neutral-900/80 select-none">
      {/* Top Drag Region for macOS + Brand */}
      <div className="app-drag-region pt-8 pb-3 px-4 flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800/80">
        <div className="flex items-center gap-2.5">
          <img
            src={appIcon}
            alt="Synapse"
            className="w-8 h-8 rounded-xl object-cover shadow-sm flex-shrink-0"
          />
          <div>
            <h1
              className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
              title="Synapse by zemskov.space"
            >
              Synapse
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  ollamaOnline
                    ? 'bg-neutral-700 dark:bg-neutral-300'
                    : 'bg-neutral-400 dark:bg-neutral-600'
                }`}
              />
              <span>{ollamaOnline ? t.sidebar.serverOnline : t.sidebar.serverOffline}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenSettings('general')}
          className="app-no-drag p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/80 dark:hover:bg-neutral-800 transition-colors"
          title={t.sidebar.settingsTooltip}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons: Regular Chat & Incognito RAM Chat */}
      <div className="p-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onCreateChat(false)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900 text-neutral-100 shadow-sm transition-all"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          <span>{t.sidebar.newChat}</span>
        </button>

        <button
          type="button"
          onClick={() => onCreateChat(true)}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-neutral-200/90 hover:bg-neutral-300/80 dark:bg-neutral-800/90 dark:hover:bg-neutral-700/80 text-neutral-800 dark:text-neutral-200 border border-neutral-300/80 dark:border-neutral-700/80 transition-all"
          title={t.sidebar.incognitoTooltip}
        >
          <Ghost className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-400" />
          <span>{t.sidebar.incognito}</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.sidebar.searchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white dark:bg-neutral-950 border border-neutral-200/90 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-500 dark:focus:border-neutral-600 transition-colors"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {chats.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
            {searchQuery ? t.sidebar.noSearchMatches : t.sidebar.noActiveChats}
          </div>
        ) : (
          chats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const modelDisplay = formatModelDisplayName(chat.model, providers);
            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`group relative flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all ${
                  isActive
                    ? 'bg-white dark:bg-neutral-800/95 border border-neutral-300/90 dark:border-neutral-700 shadow-sm text-neutral-900 dark:text-neutral-100'
                    : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 border border-transparent'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {chat.incognito ? (
                    <Ghost className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                  ) : (
                    <Database className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium truncate">{chat.title}</p>
                    {chat.incognito && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                        RAM
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500">
                    {chat.parentChatId && (
                      <span
                        className="inline-flex items-center gap-0.5 text-neutral-500 dark:text-neutral-400"
                        title={`${t.header.fromChat} ${chat.parentChatTitle || chat.parentChatId}`}
                      >
                        <GitBranch className="w-2.5 h-2.5" />
                      </span>
                    )}
                    <span className="truncate max-w-[104px] font-mono" title={modelDisplay}>
                      {modelDisplay || t.sidebar.modelNotSelected}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(chat.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                  <button
                    type="button"
                    onClick={(e) => onDuplicateChat(chat.id, e)}
                    className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-neutral-700/60 transition-all"
                    title={t.sidebar.duplicateChatTooltip}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => onDeleteChat(chat.id, e)}
                    className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-neutral-700/60 transition-all"
                    title={t.sidebar.deleteChatTooltip}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Navigation Menu: Memory, MCP Servers, Skills */}
      <div className="p-2.5 border-t border-neutral-200/80 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => onOpenSettings('memory')}
          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-neutral-200/70 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
        >
          <BrainCircuit className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">
            {t.sidebar.memoryBtn} ({memoryCount})
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpenSettings('mcp')}
          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-neutral-200/70 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
        >
          <Blocks className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">
            {t.sidebar.mcpBtn} ({connectedMcpCount})
          </span>
        </button>

        <button
          type="button"
          onClick={() => onOpenSettings('skills')}
          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg hover:bg-neutral-200/70 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
        >
          <Wand2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">
            {t.sidebar.skillsBtn} ({skillsCount})
          </span>
        </button>
      </div>
    </aside>
  );
};
