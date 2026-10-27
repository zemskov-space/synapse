import React, { useEffect, useRef, useState } from 'react';
import type {
  AiProviderConfig,
  ChatRecord,
  MessageRecord,
  OllamaModelInfo,
  OllamaRunningModel,
  AppSettings,
  UserMemoryItem,
  McpServerStatus,
  McpServerConfig,
  SkillRecord,
} from './types/chat';
import { I18nProvider, getTranslationDictionary } from './i18n';
import { formatLocalDateTime } from './utils/formatters';
import { Sidebar } from './components/Sidebar';
import { SettingsModal, type SettingsTabId } from './components/SettingsModal';
import { DeveloperModal, type DevModalTabId } from './components/dev/DeveloperModal';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { ChatHeader } from './components/chat/ChatHeader';
import { MessageList } from './components/chat/MessageList';
import { ChatComposer } from './components/chat/ChatComposer';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    ollamaHost: 'http://127.0.0.1:11434',
    ollamaApiKey: '',
    theme: 'system',
    language: 'ru',
    defaultModel: '',
    enableNotifications: true,
    onboardingCompleted: true,
    compressionThresholdRatio: 0.72,
    keepRecentMessages: 6,
    customSystemPromptAddon: '',
    enableWebTools: true,
  });
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [systemDark, setSystemDark] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabId>('general');

  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const [devModalInitialTab, setDevModalInitialTab] = useState<DevModalTabId>('tables');

  const [memories, setMemories] = useState<UserMemoryItem[]>([]);
  const [recentMemoryToast, setRecentMemoryToast] = useState<string | null>(null);

  const [providers, setProviders] = useState<AiProviderConfig[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerStatus[]>([]);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [selectedSkillsForNextMsg, setSelectedSkillsForNextMsg] = useState<SkillRecord[]>([]);

  const [models, setModels] = useState<OllamaModelInfo[]>([]);
  const [runningModels, setRunningModels] = useState<OllamaRunningModel[]>([]);
  const [ollamaOnline, setOllamaOnline] = useState<boolean>(false);
  const [isTogglingModelMemory, setIsTogglingModelMemory] = useState<boolean>(false);

  const [chats, setChats] = useState<ChatRecord[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  const [activeChat, setActiveChat] = useState<ChatRecord | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [isStreaming, setIsStreaming] = useState(false);
  const [compressionNotice, setCompressionNotice] = useState('');
  const [showSummaryBanner, setShowSummaryBanner] = useState(false);
  const [targetTokensPerSec, setTargetTokensPerSec] = useState<number | null>(null);
  const [smoothTokensPerSec, setSmoothTokensPerSec] = useState<number | null>(null);
  const lastStatUpdateRef = useRef<number>(0);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const isDark =
    settings.theme === 'dark' || (settings.theme === 'system' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    document.documentElement.lang = settings.language || 'ru';
  }, [settings.language]);

  // Smoothly interpolate tokens/sec value
  useEffect(() => {
    if (targetTokensPerSec === null) {
      setSmoothTokensPerSec(null);
      return;
    }
    const interval = setInterval(() => {
      setSmoothTokensPerSec((prev) => {
        if (prev === null) return targetTokensPerSec;
        const diff = targetTokensPerSec - prev;
        if (Math.abs(diff) < 0.15) return Number(targetTokensPerSec.toFixed(1));
        return Number((prev + diff * 0.22).toFixed(1));
      });
    }, 65);
    return () => clearInterval(interval);
  }, [targetTokensPerSec]);

  // Initial load: settings, memories, providers, mcp, skills, models, chats
  useEffect(() => {
    async function bootstrap() {
      const loadedSettings = await window.electronAPI.getSettings();
      setSettings(loadedSettings);
      setSystemDark(loadedSettings.systemDark);

      const [loadedMemories, loadedProviders, loadedMcp, loadedSkills] =
        await Promise.all([
          window.electronAPI.listMemories(),
          window.electronAPI.listProviders(),
          window.electronAPI.listMcpServers(),
          window.electronAPI.listSkills(),
        ]);
      setMemories(loadedMemories);
      setProviders(loadedProviders);
      setMcpServers(loadedMcp);
      setSkills(loadedSkills);

      const modelRes = await window.electronAPI.listModels();
      setOllamaOnline(modelRes.ok);
      setModels(modelRes.models || []);

      const psRes = await window.electronAPI.getRunningModels();
      if (psRes.ok) {
        setRunningModels(psRes.models || []);
      }

      const initialChats = await window.electronAPI.listChats('');
      setChats(initialChats);
      if (initialChats.length > 0) {
        await selectChat(initialChats[0].id);
      } else {
        const preferredModel =
          loadedSettings.defaultModel || modelRes.models?.[0]?.name || 'llama3.2';
        const created = await window.electronAPI.createChat({
          model: preferredModel,
          incognito: false,
        });
        setChats([created]);
        setActiveChatId(created.id);
        setActiveChat(created);
        setMessages([]);
      }
      setIsBootstrapped(true);
    }
    bootstrap();

    const unsubTheme = window.electronAPI.onSystemThemeChanged((dark) => {
      setSystemDark(dark);
    });
    return () => unsubTheme();
  }, []);

  // Poll running models in memory (/api/ps) every 4 seconds
  useEffect(() => {
    const timer = setInterval(async () => {
      const psRes = await window.electronAPI.getRunningModels();
      setOllamaOnline(psRes.ok);
      if (psRes.ok) {
        setRunningModels(psRes.models || []);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to streaming chunks from main process
  useEffect(() => {
    const unsubscribe = window.electronAPI.onStreamChunk((payload) => {
      if (payload.compressionNotice !== undefined) {
        setCompressionNotice(payload.compressionNotice);
        return;
      }

      if (payload.chatTitleUpdated) {
        setActiveChat((prev) =>
          prev && prev.id === payload.chatId
            ? { ...prev, title: payload.chatTitleUpdated! }
            : prev
        );
        setChats((prev) =>
          prev.map((c) =>
            c.id === payload.chatId ? { ...c, title: payload.chatTitleUpdated! } : c
          )
        );
      }

      if (payload.memoriesChanged) {
        const dict = getTranslationDictionary(settings.language);
        setRecentMemoryToast(dict.header.memoryUpdatedToast);
        window.electronAPI.listMemories().then(setMemories);
        setTimeout(() => {
          setRecentMemoryToast(null);
        }, 4500);
      }

      if (payload.chatId !== activeChatId) return;

      if (payload.stats && typeof payload.stats.tokensPerSec === 'number') {
        const nowMs = Date.now();
        if (payload.done || nowMs - lastStatUpdateRef.current > 280) {
          lastStatUpdateRef.current = nowMs;
          setTargetTokensPerSec((prev) =>
            prev === null || payload.done
              ? payload.stats!.tokensPerSec
              : Number((prev * 0.65 + payload.stats!.tokensPerSec * 0.35).toFixed(1))
          );
        }
      }

      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === payload.messageId);
        if (idx === -1) {
          const now = new Date();
          const newAssistantMsg: MessageRecord = {
            id: payload.messageId,
            chatId: payload.chatId,
            role: 'assistant',
            content: payload.contentDelta || '',
            thinking: payload.thinkingDelta || undefined,
            toolCalls: payload.toolCalls,
            stats: payload.stats,
            timestamp: now.toISOString(),
            formattedTime: formatLocalDateTime(now),
          };
          return [...prev, newAssistantMsg];
        } else {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            content: payload.contentDelta ?? updated[idx].content,
            thinking: payload.thinkingDelta || updated[idx].thinking,
            toolCalls: payload.toolCalls ?? updated[idx].toolCalls,
            stats: payload.stats ?? updated[idx].stats,
          };
          return updated;
        }
      });

      if (payload.done) {
        setIsStreaming(false);
        setCompressionNotice('');
      }
    });

    return () => unsubscribe();
  }, [activeChatId, settings.language]);

  const refreshChatsList = async (query = searchQuery) => {
    const list = await window.electronAPI.listChats(query);
    setChats(list);
  };

  const refreshModels = async () => {
    const [mRes, psRes] = await Promise.all([
      window.electronAPI.listModels(),
      window.electronAPI.getRunningModels(),
    ]);
    setOllamaOnline(mRes.ok);
    if (mRes.ok) setModels(mRes.models);
    if (psRes.ok) setRunningModels(psRes.models);
  };

  const selectChat = async (chatId: string) => {
    setActiveChatId(chatId);
    const { chat, messages: chatMsgs } = await window.electronAPI.getChatMessages(chatId);
    setActiveChat(chat);
    setMessages(chatMsgs);
    setShowSummaryBanner(false);
    const lastAssistantWithStats = [...chatMsgs]
      .reverse()
      .find((m) => m.role === 'assistant' && m.stats?.tokensPerSec);
    const initialTps = lastAssistantWithStats?.stats?.tokensPerSec ?? null;
    setTargetTokensPerSec(initialTps);
    setSmoothTokensPerSec(initialTps);
  };

  const resolvePreferredModelForNewChat = () => {
    return (
      settings.defaultModel ||
      activeChat?.model ||
      models[0]?.name ||
      'llama3.2'
    );
  };

  const handleCreateChat = async (incognito: boolean) => {
    const defaultModel = resolvePreferredModelForNewChat();
    const isEn = settings.language === 'en';
    const title = isEn
      ? incognito
        ? 'Incognito Chat'
        : 'New Chat'
      : undefined;
    const created = await window.electronAPI.createChat({
      model: defaultModel,
      incognito,
      title,
    });
    await refreshChatsList();
    await selectChat(created.id);
  };

  const handleDuplicateChat = async (chatIdToCopy: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const duplicated = await window.electronAPI.duplicateChat(chatIdToCopy);
    await refreshChatsList();
    await selectChat(duplicated.id);
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await window.electronAPI.deleteChat(chatId);
    const updatedList = await window.electronAPI.listChats(searchQuery);
    setChats(updatedList);
    if (activeChatId === chatId) {
      if (updatedList.length > 0) {
        await selectChat(updatedList[0].id);
      } else {
        await handleCreateChat(false);
      }
    }
  };

  const handleSearchChange = async (q: string) => {
    setSearchQuery(q);
    await refreshChatsList(q);
  };

  const handleModelChangeForActiveChat = async (newModel: string) => {
    if (!activeChat) return;
    const updated = await window.electronAPI.updateChat({
      chatId: activeChat.id,
      model: newModel,
    });
    if (updated) {
      setActiveChat(updated);
      await refreshChatsList();
    }
  };

  const currentModelName = activeChat?.model || models[0]?.name || '';
  const loadedModelInfo = runningModels.find(
    (rm) => rm.name === currentModelName || rm.model === currentModelName
  );

  const handleToggleModelMemory = async () => {
    if (!currentModelName || isTogglingModelMemory) return;
    setIsTogglingModelMemory(true);
    try {
      await window.electronAPI.toggleLoadModel(currentModelName, !loadedModelInfo);
      const psRes = await window.electronAPI.getRunningModels();
      if (psRes.ok) setRunningModels(psRes.models || []);
    } finally {
      setIsTogglingModelMemory(false);
    }
  };

  const sendMessageToChat = async (
    textToSend: string,
    imagesToSend: string[] = [],
    rewindToMessageId?: string
  ) => {
    if (!activeChat || (!textToSend.trim() && imagesToSend.length === 0) || isStreaming) {
      return;
    }

    const targetChatId = activeChat.id;
    const now = new Date();
    const optimisticUserMsg: MessageRecord = {
      id: `temp-${now.getTime()}`,
      chatId: targetChatId,
      role: 'user',
      content: textToSend,
      images: imagesToSend.length > 0 ? imagesToSend : undefined,
      timestamp: now.toISOString(),
      formattedTime: formatLocalDateTime(now),
    };

    const skillIdsToSend = selectedSkillsForNextMsg.map((s) => s.id);

    if (rewindToMessageId) {
      setMessages((prev) => {
        const targetIdx = prev.findIndex((m) => m.id === rewindToMessageId);
        const sliced = targetIdx !== -1 ? prev.slice(0, targetIdx) : prev;
        return [...sliced, optimisticUserMsg];
      });
    } else {
      setMessages((prev) => [...prev, optimisticUserMsg]);
      setSelectedSkillsForNextMsg([]);
    }

    setIsStreaming(true);

    const res = await window.electronAPI.sendMessage({
      chatId: targetChatId,
      content: textToSend,
      images: imagesToSend,
      model: activeChat.model,
      rewindToMessageId,
      activeSkillIds: skillIdsToSend.length > 0 ? skillIdsToSend : undefined,
    });

    if (activeChatIdRef.current === targetChatId) {
      if (res.chat) {
        setActiveChat(res.chat);
      }
      const { messages: syncedMessages } = await window.electronAPI.getChatMessages(targetChatId);
      if (activeChatIdRef.current === targetChatId) {
        setMessages(syncedMessages);
      }
    }
    await refreshChatsList();

    const [psRes, latestMem] = await Promise.all([
      window.electronAPI.getRunningModels(),
      window.electronAPI.listMemories(),
    ]);
    if (psRes.ok) setRunningModels(psRes.models || []);
    setMemories(latestMem);
  };

  const handleStopGeneration = async () => {
    if (!activeChat) return;
    await window.electronAPI.stopGeneration(activeChat.id);
    setIsStreaming(false);
  };

  const handleSaveSettings = async (partial: Partial<AppSettings>) => {
    const saved = await window.electronAPI.saveSettings(partial);
    setSettings(saved);
    setSystemDark(saved.systemDark);
    const [latestSkills] = await Promise.all([
      window.electronAPI.listSkills(),
      refreshModels(),
    ]);
    setSkills(latestSkills);
  };

  const handleCompleteOnboarding = async (
    finalPartial: Partial<AppSettings>,
    discoveredModels: OllamaModelInfo[]
  ) => {
    const saved = await window.electronAPI.saveSettings(finalPartial);
    setSettings(saved);
    setSystemDark(saved.systemDark);
    setOllamaOnline(true);
    if (discoveredModels.length > 0) {
      setModels(discoveredModels);
    }
    if (activeChat && messages.length === 0 && saved.defaultModel) {
      await handleModelChangeForActiveChat(saved.defaultModel);
    }
    const [latestSkills] = await Promise.all([
      window.electronAPI.listSkills(),
      refreshModels(),
    ]);
    setSkills(latestSkills);
  };

  // External Providers CRUD
  const handleSaveProvider = async (
    prov: Omit<AiProviderConfig, 'id' | 'createdAt'> & { id?: string }
  ) => {
    const updated = await window.electronAPI.saveProvider(prov);
    setProviders(updated);
  };

  const handleDeleteProvider = async (id: string) => {
    const updated = await window.electronAPI.deleteProvider(id);
    setProviders(updated);
  };

  // Memory CRUD handlers
  const handleAddMemory = async (content: string) => {
    const updated = await window.electronAPI.addMemory(content);
    setMemories(updated);
  };

  const handleUpdateMemory = async (id: string, content: string) => {
    const updated = await window.electronAPI.updateMemory({ id, content });
    setMemories(updated);
  };

  const handleDeleteMemory = async (id: string) => {
    const updated = await window.electronAPI.deleteMemory(id);
    setMemories(updated);
  };

  const handleClearMemories = async () => {
    const updated = await window.electronAPI.clearMemories();
    setMemories(updated);
  };

  // MCP & Skills handlers
  const handleSaveMcpServer = async (
    srv: Omit<McpServerConfig, 'id' | 'createdAt'> & { id?: string }
  ) => {
    const updated = await window.electronAPI.saveMcpServer(srv);
    setMcpServers(updated);
  };

  const handleDeleteMcpServer = async (id: string) => {
    const updated = await window.electronAPI.deleteMcpServer(id);
    setMcpServers(updated);
  };

  const handleReconnectMcpServer = async (id: string) => {
    const updated = await window.electronAPI.reconnectMcpServer(id);
    setMcpServers(updated);
  };

  const handleSaveSkill = async (
    sk: Omit<SkillRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => {
    const updated = await window.electronAPI.saveSkill(sk);
    setSkills(updated);
  };

  const handleDeleteSkill = async (id: string) => {
    const updated = await window.electronAPI.deleteSkill(id);
    setSkills(updated);
    setSelectedSkillsForNextMsg((prev) => prev.filter((s) => s.id !== id));
  };

  const openSettingsAtTab = (tab: SettingsTabId = 'general') => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  const handleDatabaseMutatedFromDev = async () => {
    const [
      loadedSettings,
      loadedMemories,
      loadedProviders,
      loadedMcp,
      loadedSkills,
      updatedChats,
    ] = await Promise.all([
      window.electronAPI.getSettings(),
      window.electronAPI.listMemories(),
      window.electronAPI.listProviders(),
      window.electronAPI.listMcpServers(),
      window.electronAPI.listSkills(),
      window.electronAPI.listChats(searchQuery),
    ]);
    setSettings(loadedSettings);
    setSystemDark(loadedSettings.systemDark);
    setMemories(loadedMemories);
    setProviders(loadedProviders);
    setMcpServers(loadedMcp);
    setSkills(loadedSkills);
    setChats(updatedChats);

    if (activeChatId) {
      const { chat, messages: chatMsgs } = await window.electronAPI.getChatMessages(activeChatId);
      if (chat) {
        setActiveChat(chat);
        setMessages(chatMsgs);
      } else if (updatedChats.length > 0) {
        await selectChat(updatedChats[0].id);
      } else {
        setActiveChat(null);
        setMessages([]);
      }
    }
  };

  const enabledSkillsCount = skills.filter((s) => s.enabled).length;
  const connectedMcpCount = mcpServers.filter((s) => s.status === 'connected').length;

  return (
    <I18nProvider language={settings.language || 'ru'}>
      <div className="flex h-screen w-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
        {/* Left Sidebar */}
        <Sidebar
          chats={chats}
          activeChatId={activeChatId}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSelectChat={selectChat}
          onCreateChat={handleCreateChat}
          onDuplicateChat={handleDuplicateChat}
          onDeleteChat={handleDeleteChat}
          onOpenSettings={openSettingsAtTab}
          ollamaOnline={ollamaOnline}
          memoryCount={memories.length}
          connectedMcpCount={connectedMcpCount}
          skillsCount={enabledSkillsCount}
          providers={providers}
        />

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col h-full min-w-0">
          <ChatHeader
            activeChat={activeChat}
            chats={chats}
            recentMemoryToast={recentMemoryToast}
            showSummaryBanner={showSummaryBanner}
            onToggleSummaryBanner={() => setShowSummaryBanner(!showSummaryBanner)}
            compressionNotice={compressionNotice}
            onSelectChat={selectChat}
            onDuplicateChat={handleDuplicateChat}
          />

          <MessageList
            messages={messages}
            activeChat={activeChat}
            runningModels={runningModels}
            providers={providers}
            isStreaming={isStreaming}
            isDark={isDark}
            onSendMessage={sendMessageToChat}
          />

          <ChatComposer
            activeChat={activeChat}
            messages={messages}
            settings={settings}
            models={models}
            runningModels={runningModels}
            providers={providers}
            mcpServers={mcpServers}
            skills={skills}
            selectedSkills={selectedSkillsForNextMsg}
            onSelectedSkillsChange={setSelectedSkillsForNextMsg}
            isStreaming={isStreaming}
            isTogglingModelMemory={isTogglingModelMemory}
            smoothTokensPerSec={smoothTokensPerSec}
            onSendMessage={sendMessageToChat}
            onStopGeneration={handleStopGeneration}
            onModelChange={handleModelChangeForActiveChat}
            onRefreshModels={refreshModels}
            onToggleModelMemory={handleToggleModelMemory}
            onOpenSettings={openSettingsAtTab}
          />
        </main>

        {/* Settings, Providers, Memory, MCP & Skills Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          initialTab={settingsInitialTab}
          settings={settings}
          models={models}
          providers={providers}
          memories={memories}
          mcpServers={mcpServers}
          skills={skills}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
          onSaveProvider={handleSaveProvider}
          onDeleteProvider={handleDeleteProvider}
          onAddMemory={handleAddMemory}
          onUpdateMemory={handleUpdateMemory}
          onDeleteMemory={handleDeleteMemory}
          onClearMemories={handleClearMemories}
          onSaveMcpServer={handleSaveMcpServer}
          onDeleteMcpServer={handleDeleteMcpServer}
          onReconnectMcpServer={handleReconnectMcpServer}
          onSaveSkill={handleSaveSkill}
          onDeleteSkill={handleDeleteSkill}
          onOpenDatabaseEditor={() => {
            setDevModalInitialTab('tables');
            setIsDevModalOpen(true);
          }}
        />

        {/* Developer Menu & SQLite Database Inspector Modal */}
        <DeveloperModal
          isOpen={isDevModalOpen}
          initialTab={devModalInitialTab}
          onClose={() => setIsDevModalOpen(false)}
          onDatabaseMutated={handleDatabaseMutatedFromDev}
        />

        {/* First-Run Onboarding Wizard */}
        <OnboardingModal
          isOpen={isBootstrapped && !settings.onboardingCompleted}
          settings={settings}
          onLivePreviewChange={(partial) =>
            setSettings((prev) => ({ ...prev, ...partial }))
          }
          onCompleteOnboarding={handleCompleteOnboarding}
        />
      </div>
    </I18nProvider>
  );
};
export default App;
