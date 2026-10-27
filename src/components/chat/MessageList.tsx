import React, { useEffect, useRef, useState } from 'react';
import { Clock, Pencil, Gauge, RotateCcw, RefreshCw } from 'lucide-react';
import type {
  AiProviderConfig,
  ChatRecord,
  MessageRecord,
  OllamaRunningModel,
} from '../../types/chat';
import { MarkdownContent } from '../MarkdownContent';
import { ThinkingBlock } from '../ThinkingBlock';
import { ToolCallsBlock } from '../ToolCallsBlock';
import { ChatEmptyState } from './ChatEmptyState';
import { useI18n } from '../../i18n';
import {
  formatModelDisplayName,
  isExternalProviderModel,
} from '../../utils/formatters';

interface MessageListProps {
  messages: MessageRecord[];
  activeChat: ChatRecord | null;
  runningModels: OllamaRunningModel[];
  providers: AiProviderConfig[];
  isStreaming: boolean;
  isDark: boolean;
  onSendMessage: (
    textToSend: string,
    imagesToSend?: string[],
    rewindToMessageId?: string
  ) => Promise<void>;
}

function isErrorMessageContent(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  return (
    trimmed.startsWith('⚠️') ||
    /ошибка при обращении|error communicating|fetch failed/i.test(trimmed)
  );
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  activeChat,
  runningModels,
  providers,
  isStreaming,
  isDark,
  onSendMessage,
}) => {
  const { t } = useI18n();
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgText, setEditingMsgText] = useState<string>('');
  const [editingMsgImages, setEditingMsgImages] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setEditingMsgId(null);
    setEditingMsgText('');
    setEditingMsgImages([]);
  }, [activeChat?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  const handleConfirmRewindEdit = async (messageId: string) => {
    const text = editingMsgText;
    const imgs = editingMsgImages;
    setEditingMsgId(null);
    setEditingMsgText('');
    setEditingMsgImages([]);
    await onSendMessage(text, imgs, messageId);
  };

  const currentModel = activeChat?.model || '';
  const isExternal = isExternalProviderModel(currentModel);
  const isModelLoadedInRam =
    !isExternal &&
    runningModels.some((rm) => rm.name === currentModel || rm.model === currentModel);

  const modelDisplayName =
    formatModelDisplayName(activeChat?.model, providers) || t.messages.assistant;

  const getStreamingStatusLabel = (hasThinkingText: boolean): string => {
    if (hasThinkingText) return t.thinking.modelThinking;
    if (isExternal) return t.messages.connectingToProvider;
    if (!isModelLoadedInRam) return t.messages.loadingModelIntoRam;
    return t.messages.waitingForModelResponse;
  };

  const lastMessage = messages[messages.length - 1];
  const needsOptimisticAssistantBubble =
    isStreaming && (!lastMessage || lastMessage.role === 'user');

  const findPrecedingUserMessage = (assistantIdx: number): MessageRecord | null => {
    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        return messages[i];
      }
    }
    return null;
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
      {messages.length === 0 && !isStreaming ? (
        <ChatEmptyState
          activeChat={activeChat}
          onQuickPrompt={(prompt) => onSendMessage(prompt)}
        />
      ) : (
        <>
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isLastAssistant = !isUser && idx === messages.length - 1 && isStreaming;
            const isEditingThis = isUser && editingMsgId === msg.id;
            const isErrorMsg = !isUser && !isStreaming && isErrorMessageContent(msg.content);
            const prevUserMsg = !isUser ? findPrecedingUserMessage(idx) : null;

            return (
              <div
                key={msg.id}
                className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                {/* Message Header */}
                <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                  <span className="font-medium text-neutral-600 dark:text-neutral-300">
                    {isUser ? t.messages.you : modelDisplayName}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {msg.formattedTime}
                  </span>
                  {!isUser && msg.stats && msg.stats.tokensPerSec > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-200/60 dark:bg-neutral-800/80 text-[10px] font-mono text-neutral-500 dark:text-neutral-400"
                      title={`${msg.stats.evalCount} tok. / ${(
                        (msg.stats.totalDurationMs || 0) / 1000
                      ).toFixed(1)}s`}
                    >
                      <Gauge className="w-2.5 h-2.5" />
                      <span>
                        {Math.round(msg.stats.tokensPerSec)} {t.messages.tokensPerSec}
                      </span>
                    </span>
                  )}
                  {isUser && !isStreaming && !isEditingThis && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMsgId(msg.id);
                        setEditingMsgText(msg.content);
                        setEditingMsgImages(msg.images || []);
                      }}
                      className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-all"
                      title={t.messages.editAndRewindTooltip}
                    >
                      <Pencil className="w-2.5 h-2.5" />
                      <span>{t.messages.editAndRewind}</span>
                    </button>
                  )}
                  {msg.isCompressed && (
                    <span
                      className="px-1.5 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 text-[10px] text-neutral-500"
                      title={t.messages.compressedTooltip}
                    >
                      {t.messages.compressedBadge}
                    </span>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-3xl w-full rounded-2xl px-4 py-3 shadow-sm ${
                    isUser
                      ? isEditingThis
                        ? 'bg-white dark:bg-neutral-900 border-2 border-neutral-400 dark:border-neutral-600 text-neutral-900 dark:text-neutral-100'
                        : 'bg-neutral-800 dark:bg-neutral-200 text-neutral-100 dark:text-neutral-900 sm:w-auto sm:min-w-[260px]'
                      : 'bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100'
                  }`}
                >
                  {isEditingThis ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{t.messages.editingNotice}</span>
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={editingMsgText}
                        onChange={(e) => setEditingMsgText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleConfirmRewindEdit(msg.id);
                          } else if (e.key === 'Escape') {
                            setEditingMsgId(null);
                          }
                        }}
                        className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500 resize-y"
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setEditingMsgId(null)}
                          className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          {t.common.cancel}
                        </button>
                        <button
                          type="button"
                          disabled={!editingMsgText.trim() && editingMsgImages.length === 0}
                          onClick={() => handleConfirmRewindEdit(msg.id)}
                          className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 font-medium inline-flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{t.messages.resendFromHere}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Attached Images */}
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2.5">
                          {msg.images.map((imgSrc: string, imgIdx: number) => (
                            <img
                              key={imgIdx}
                              src={imgSrc}
                              alt="attachment"
                              className="max-h-56 rounded-xl object-cover border border-neutral-300/30 dark:border-neutral-700/40"
                            />
                          ))}
                        </div>
                      )}

                      {/* Animated Reasoning / Thinking / Pre-token Loading Block for Assistant */}
                      {!isUser &&
                        (msg.thinking ||
                          (isLastAssistant &&
                            !msg.content &&
                            (!msg.toolCalls || msg.toolCalls.length === 0))) && (
                          <ThinkingBlock
                            thinkingText={msg.thinking || ''}
                            isStreamingThinking={Boolean(isLastAssistant && !msg.content)}
                            customStreamingLabel={getStreamingStatusLabel(Boolean(msg.thinking))}
                          />
                        )}

                      {/* Function / Tool Calls Trace Block */}
                      {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                        <ToolCallsBlock toolCalls={msg.toolCalls} />
                      )}

                      {/* Subtle Skeleton Placeholder while waiting for first content token */}
                      {!isUser &&
                        isLastAssistant &&
                        !msg.content &&
                        (!msg.toolCalls || msg.toolCalls.length === 0) && (
                          <div className="space-y-2 py-1 animate-pulse">
                            <div className="h-3 bg-neutral-200/80 dark:bg-neutral-800 rounded-md w-3/4" />
                            <div className="h-3 bg-neutral-200/60 dark:bg-neutral-800/70 rounded-md w-1/2" />
                          </div>
                        )}

                      {/* Message Body */}
                      {isUser ? (
                        <div className="whitespace-pre-wrap text-[14.5px] leading-relaxed">
                          {msg.content}
                        </div>
                      ) : (
                        <>
                          <MarkdownContent
                            content={msg.content}
                            isDark={isDark}
                            onSubmitWidgetResponse={(formattedReply: string) => {
                              onSendMessage(formattedReply);
                            }}
                          />

                          {/* Retry Button when Ollama or External Provider returned an error */}
                          {isErrorMsg && prevUserMsg && (
                            <div className="mt-3 pt-2.5 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  onSendMessage(
                                    prevUserMsg.content,
                                    prevUserMsg.images || [],
                                    prevUserMsg.id
                                  )
                                }
                                className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 text-xs font-medium inline-flex items-center gap-1.5 shadow-sm transition-all"
                                title={t.messages.retryRequestTooltip}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>{t.messages.retryRequest}</span>
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Immediate Optimistic Assistant Placeholder Bubble right after user hits Send */}
          {needsOptimisticAssistantBubble && (
            <div className="group flex flex-col items-start">
              <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                <span className="font-medium text-neutral-600 dark:text-neutral-300">
                  {modelDisplayName}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>

              <div className="max-w-3xl w-full rounded-2xl px-4 py-3 shadow-sm bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100">
                <ThinkingBlock
                  thinkingText=""
                  isStreamingThinking={true}
                  customStreamingLabel={getStreamingStatusLabel(false)}
                />
                <div className="space-y-2 py-1 animate-pulse">
                  <div className="h-3 bg-neutral-200/80 dark:bg-neutral-800 rounded-md w-3/4" />
                  <div className="h-3 bg-neutral-200/60 dark:bg-neutral-800/70 rounded-md w-1/2" />
                </div>
              </div>
            </div>
          )}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};
