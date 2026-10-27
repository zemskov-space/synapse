import crypto from 'node:crypto';
import { BrowserWindow, Notification } from 'electron';
import type {
  GenerationStats,
  MessageRecord,
  ToolExecutionTrace,
} from '../../src/types/chat';
import { getTranslationDictionary } from '../../src/i18n';
import { getSettings, listSkills } from '../db';
import { executeToolCall, getAvailableTools } from '../tools';
import {
  getUnifiedChat,
  getUnifiedMessages,
  saveUnifiedMessage,
  truncateUnifiedMessagesFromId,
  updateUnifiedChat,
} from './chatStore';
import { maybeCompressContext } from './contextCompression';
import {
  buildOllamaHeaders,
  disableNativeToolsForModel,
  estimateTokens,
  formatLocalDateTime,
  isModelToolsDisabled,
  stripBase64Prefix,
} from './ollamaService';
import {
  buildOpenAiHeaders,
  normalizeOpenAiBaseUrl,
  resolveExternalProvider,
} from './openaiService';
import {
  buildSystemPromptText,
  parseThinkingAndInlineToolCalls,
} from './promptBuilder';

const activeGenerations = new Map<string, AbortController>();

export function stopChatGeneration(chatId: string): void {
  const controller = activeGenerations.get(chatId);
  if (controller) {
    controller.abort();
    activeGenerations.delete(chatId);
  }
}

export interface SendMessagePayload {
  chatId: string;
  content: string;
  images?: string[];
  model?: string;
  rewindToMessageId?: string;
  activeSkillIds?: string[];
}

function triggerCompletionNotification(
  sender: Electron.WebContents,
  chatTitle: string,
  assistantContent: string,
  lang: 'ru' | 'en'
): void {
  try {
    if (!Notification.isSupported()) return;
    const codePlaceholder = lang === 'en' ? '[code]' : '[код]';
    const cleanBody = assistantContent
      .replace(/```[\s\S]*?```/g, codePlaceholder)
      .replace(/[#*_>`~]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);

    const notification = new Notification({
      title:
        chatTitle ||
        (lang === 'en' ? 'Synapse — Response ready' : 'Synapse — Ответ готов'),
      body:
        cleanBody ||
        (lang === 'en'
          ? 'The model has finished generating a response.'
          : 'Модель завершила генерацию ответа.'),
      silent: false,
    });

    notification.on('click', () => {
      const win = BrowserWindow.fromWebContents(sender);
      if (win) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      }
    });

    notification.show();
  } catch (err) {
    console.error('Notification error:', err);
  }
}

/**
 * Main Agentic Chat Loop supporting both Local Ollama models and External OpenAI-Compatible Providers,
 * with Native Function Calling (Tools), Direct Web Search/Fetch, Global Memory, MCP, and Skills.
 */
export async function sendChatMessageAndStream(
  sender: Electron.WebContents,
  payload: SendMessagePayload
) {
  const settings = getSettings();
  const isEn = settings.language === 'en';
  let chat = getUnifiedChat(payload.chatId);
  if (!chat) {
    throw new Error(isEn ? 'Chat not found' : 'Чат не найден');
  }

  if (payload.rewindToMessageId) {
    chat = truncateUnifiedMessagesFromId(chat, payload.rewindToMessageId);
  }

  if (payload.model && payload.model !== chat.model) {
    chat = updateUnifiedChat(chat.id, { model: payload.model }) || chat;
  }

  const now = new Date();
  const userMsg: MessageRecord = {
    id: crypto.randomUUID(),
    chatId: chat.id,
    role: 'user',
    content: payload.content,
    images: payload.images && payload.images.length > 0 ? payload.images : undefined,
    timestamp: now.toISOString(),
    formattedTime: formatLocalDateTime(now),
    isCompressed: false,
  };

  saveUnifiedMessage(chat, userMsg);

  const assistantMsgId = crypto.randomUUID();
  const assistantStartDate = new Date();
  const toolTraces: ToolExecutionTrace[] = [];

  const assistantMsg: MessageRecord = {
    id: assistantMsgId,
    chatId: chat.id,
    role: 'assistant',
    content: '',
    thinking: '',
    toolCalls: [],
    timestamp: assistantStartDate.toISOString(),
    formattedTime: formatLocalDateTime(assistantStartDate),
    isCompressed: false,
  };

  // Emit immediate placeholder stream chunk BEFORE compression & model loading so UI shows the bubble right away
  sender.send('chat:stream-chunk', {
    chatId: chat.id,
    messageId: assistantMsgId,
    contentDelta: '',
    thinkingDelta: '',
    done: false,
  });

  // Check and compress old context if needed
  chat = await maybeCompressContext(chat, settings, sender);

  const activeMessages = getUnifiedMessages(chat.id).filter(
    (m) => !m.isCompressed && m.id !== assistantMsgId
  );

  // Now persist the assistant placeholder message after activeMessages snapshot
  saveUnifiedMessage(chat, assistantMsg);

  const allSkills = listSkills().filter((s) => s.enabled);
  const selectedSkillSet = new Set(payload.activeSkillIds || []);
  for (const s of allSkills) {
    const regex = new RegExp(`(?:^|\\s)/${s.slug}(?:\\s|$)`, 'i');
    if (regex.test(payload.content)) {
      selectedSkillSet.add(s.id);
    }
  }
  const triggeredSkills = allSkills.filter((s) => selectedSkillSet.has(s.id));

  const abortController = new AbortController();
  activeGenerations.set(chat.id, abortController);

  const dict = getTranslationDictionary(settings.language);
  const externalResolved = resolveExternalProvider(chat.model);
  const toolsList = getAvailableTools({
    incognito: Boolean(chat.incognito),
    enableWebTools: settings.enableWebTools !== false,
    language: settings.language,
  });

  let useNativeTools = !isModelToolsDisabled(chat.model);
  const maxToolIterations = 5;
  let iteration = 0;

  let totalAccumulatedThinking = '';
  let finalVisibleContent = '';
  const generationStartTimeMs = Date.now();
  let latestStats: GenerationStats | undefined;

  // Build conversation messages for Ollama or OpenAI
  const ollamaMessages: Array<{
    role: string;
    content: string;
    images?: string[];
    tool_calls?: unknown[];
  }> = [
    {
      role: 'system',
      content: buildSystemPromptText(chat, settings, allSkills, triggeredSkills),
    },
  ];

  const openAiMessages: Array<Record<string, unknown>> = [
    {
      role: 'system',
      content: buildSystemPromptText(chat, settings, allSkills, triggeredSkills),
    },
  ];

  for (const m of activeMessages) {
    const msgObj: { role: string; content: string; images?: string[] } = {
      role: m.role,
      content: `[${m.formattedTime}] ${m.content}`,
    };
    if (m.images && m.images.length > 0) {
      msgObj.images = m.images.map(stripBase64Prefix);
    }
    ollamaMessages.push(msgObj);

    if (m.images && m.images.length > 0 && m.role === 'user') {
      const contentParts: Array<Record<string, unknown>> = [
        { type: 'text', text: `[${m.formattedTime}] ${m.content}` },
      ];
      for (const imgDataUrl of m.images) {
        const url = imgDataUrl.startsWith('data:')
          ? imgDataUrl
          : `data:image/png;base64,${imgDataUrl}`;
        contentParts.push({
          type: 'image_url',
          image_url: { url },
        });
      }
      openAiMessages.push({
        role: m.role,
        content: contentParts,
      });
    } else {
      openAiMessages.push({
        role: m.role,
        content: `[${m.formattedTime}] ${m.content}`,
      });
    }
  }

  let interruptedByToolCall = false;
  let continuationRetried = false;

  const mergeVisibleSteps = (prevText: string, nextText: string): string => {
    if (!prevText) return nextText;
    if (!nextText) return prevText;
    const prevTrimmedEnd = prevText.replace(/\s+$/, '');
    // If previous chunk ended mid-sentence (no terminal punctuation or code block fence), join smoothly
    if (!/[.!?:;»"`)\]\n]$/.test(prevTrimmedEnd)) {
      return `${prevTrimmedEnd} ${nextText.trimStart()}`;
    }
    return `${prevTrimmedEnd}\n\n${nextText.trimStart()}`;
  };

  try {
    while (iteration < maxToolIterations) {
      iteration++;

      const freshSystemPrompt = buildSystemPromptText(
        chat,
        settings,
        allSkills,
        triggeredSkills
      );
      ollamaMessages[0].content = freshSystemPrompt;
      openAiMessages[0].content = freshSystemPrompt;

      let stepRawContent = '';
      let stepNativeThinking = '';
      const normalizedCalls: Array<{
        id?: string;
        name: string;
        args: Record<string, unknown>;
        isNative?: boolean;
      }> = [];

      if (externalResolved) {
        // ==========================================================
        // EXTERNAL OPENAI-COMPATIBLE PROVIDER STREAMING (/chat/completions)
        // ==========================================================
        const { provider, modelId } = externalResolved;
        const rootUrl = normalizeOpenAiBaseUrl(provider.baseUrl);
        const endpoint = `${rootUrl}/chat/completions`;

        const reqBody: Record<string, unknown> = {
          model: modelId,
          stream: true,
          messages: openAiMessages,
        };
        if (useNativeTools && toolsList.length > 0) {
          reqBody.tools = toolsList;
        }

        let response = await fetch(endpoint, {
          method: 'POST',
          headers: buildOpenAiHeaders(provider.apiKey),
          signal: abortController.signal,
          body: JSON.stringify(reqBody),
        });

        if (!response.ok && useNativeTools) {
          const errText = await response.text().catch(() => '');
          if (
            (response.status === 400 || response.status === 422) &&
            /tool|function|reasoning_content/i.test(errText)
          ) {
            disableNativeToolsForModel(chat.model);
            useNativeTools = false;
            delete reqBody.tools;
            response = await fetch(endpoint, {
              method: 'POST',
              headers: buildOpenAiHeaders(provider.apiKey),
              signal: abortController.signal,
              body: JSON.stringify(reqBody),
            });
          } else {
            throw new Error(`${provider.name} (${response.status}): ${errText}`);
          }
        }

        if (!response.ok || !response.body) {
          const errText = await response.text().catch(() => `HTTP ${response.status}`);
          throw new Error(`${provider.name} (${response.status}): ${errText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';

        const openAiToolCallBuilders = new Map<
          number,
          { id: string; name: string; argumentsText: string }
        >();

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            sseBuffer += decoder.decode();
          } else {
            sseBuffer += decoder.decode(value, { stream: true });
          }

          const lines = sseBuffer.split('\n');
          sseBuffer = done ? '' : lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith('data:')) continue;
            const dataStr = line.slice(5).trim();
            if (dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr) as {
                choices?: Array<{
                  delta?: {
                    content?: string | null;
                    reasoning_content?: string | null;
                    reasoning?: string | null;
                    tool_calls?: Array<{
                      index?: number;
                      id?: string;
                      function?: { name?: string; arguments?: string };
                    }>;
                  };
                  message?: {
                    content?: string | null;
                    reasoning_content?: string | null;
                  };
                }>;
                error?: { message?: string } | string;
              };

              if (parsed.error) {
                const msg =
                  typeof parsed.error === 'string'
                    ? parsed.error
                    : parsed.error.message || 'API Error';
                throw new Error(msg);
              }

              const choice = parsed.choices?.[0];
              const delta = choice?.delta || choice?.message;
              if (!delta) continue;

              const reasoningDelta =
                (delta as { reasoning_content?: string | null }).reasoning_content ||
                (delta as { reasoning?: string | null }).reasoning;
              if (reasoningDelta) {
                stepNativeThinking += reasoningDelta;
              }

              if (typeof delta.content === 'string') {
                stepRawContent += delta.content;
              }

              const deltaToolCalls = (
                choice?.delta as {
                  tool_calls?: Array<{
                    index?: number;
                    id?: string;
                    function?: { name?: string; arguments?: string };
                  }>;
                }
              )?.tool_calls;

              if (Array.isArray(deltaToolCalls)) {
                for (const tc of deltaToolCalls) {
                  const idx = typeof tc.index === 'number' ? tc.index : 0;
                  const existing = openAiToolCallBuilders.get(idx) || {
                    id: tc.id || `call_${idx}_${Date.now()}`,
                    name: '',
                    argumentsText: '',
                  };
                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) existing.name += tc.function.name;
                  if (tc.function?.arguments) existing.argumentsText += tc.function.arguments;
                  openAiToolCallBuilders.set(idx, existing);
                }
              }

              const parsedInline = parseThinkingAndInlineToolCalls(stepRawContent);
              const combinedStepThinking = [stepNativeThinking, parsedInline.thinking]
                .filter(Boolean)
                .join('\n')
                .trim();

              const currentTotalThinking = [totalAccumulatedThinking, combinedStepThinking]
                .filter(Boolean)
                .join('\n\n')
                .trim();

              const elapsedSec = Math.max(0.15, (Date.now() - generationStartTimeMs) / 1000);
              const approxTokens = estimateTokens(
                (
                  finalVisibleContent +
                  ' ' +
                  parsedInline.visibleContent +
                  ' ' +
                  currentTotalThinking
                ).trim()
              );
              if (approxTokens > 0) {
                latestStats = {
                  tokensPerSec: Number((approxTokens / elapsedSec).toFixed(1)),
                  evalCount: approxTokens,
                  totalDurationMs: Math.round(elapsedSec * 1000),
                };
              }

              assistantMsg.content = mergeVisibleSteps(
                finalVisibleContent,
                parsedInline.visibleContent
              );
              assistantMsg.thinking = currentTotalThinking || undefined;
              assistantMsg.toolCalls = toolTraces.length > 0 ? [...toolTraces] : undefined;
              assistantMsg.stats = latestStats;

              sender.send('chat:stream-chunk', {
                chatId: chat.id,
                messageId: assistantMsgId,
                contentDelta: assistantMsg.content,
                thinkingDelta: currentTotalThinking,
                toolCalls: assistantMsg.toolCalls,
                stats: latestStats,
                done: false,
              });
            } catch (parseErr) {
              if (
                parseErr instanceof Error &&
                !parseErr.message.includes('Unexpected') &&
                !parseErr.message.includes('JSON')
              ) {
                throw parseErr;
              }
            }
          }

          if (done) break;
        }

        const openAiAssistantToolCallsForHistory: Array<Record<string, unknown>> = [];
        for (const built of openAiToolCallBuilders.values()) {
          if (!built.name) continue;
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = built.argumentsText ? JSON.parse(built.argumentsText) : {};
          } catch {
            parsedArgs = {};
          }
          normalizedCalls.push({
            id: built.id,
            name: built.name,
            args: parsedArgs,
            isNative: true,
          });
          openAiAssistantToolCallsForHistory.push({
            id: built.id,
            type: 'function',
            function: {
              name: built.name,
              arguments: built.argumentsText || '{}',
            },
          });
        }

        const finalStepParsed = parseThinkingAndInlineToolCalls(stepRawContent);
        for (const inlineTc of finalStepParsed.inlineToolCalls) {
          normalizedCalls.push({
            name: inlineTc.name,
            args: inlineTc.arguments,
            isNative: false,
          });
        }

        if (normalizedCalls.length > 0) {
          openAiMessages.push({
            role: 'assistant',
            content: stepRawContent || '',
            ...(stepNativeThinking ? { reasoning_content: stepNativeThinking } : {}),
            ...(openAiAssistantToolCallsForHistory.length > 0
              ? { tool_calls: openAiAssistantToolCallsForHistory }
              : {}),
          });
        }
      } else {
        // ==========================================================
        // LOCAL OLLAMA STREAMING (/api/chat)
        // ==========================================================
        const host = settings.ollamaHost.replace(/\/$/, '');
        const requestBody: Record<string, unknown> = {
          model: chat.model,
          stream: true,
          messages: ollamaMessages,
        };
        if (useNativeTools && toolsList.length > 0) {
          requestBody.tools = toolsList;
        }

        let response = await fetch(`${host}/api/chat`, {
          method: 'POST',
          headers: buildOllamaHeaders(settings.ollamaApiKey, {
            'Content-Type': 'application/json',
          }),
          signal: abortController.signal,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok && useNativeTools) {
          const errText = await response.text().catch(() => '');
          if (response.status === 400 && /does not support tools|tool/i.test(errText)) {
            disableNativeToolsForModel(chat.model);
            useNativeTools = false;
            delete requestBody.tools;
            response = await fetch(`${host}/api/chat`, {
              method: 'POST',
              headers: buildOllamaHeaders(settings.ollamaApiKey, {
                'Content-Type': 'application/json',
              }),
              signal: abortController.signal,
              body: JSON.stringify(requestBody),
            });
          } else {
            throw new Error(
              `${isEn ? 'Ollama error' : 'Ошибка Ollama'} (${response.status}): ${errText}`
            );
          }
        }

        if (!response.ok || !response.body) {
          const errText = await response.text().catch(() => `HTTP ${response.status}`);
          throw new Error(
            `${isEn ? 'Ollama error' : 'Ошибка Ollama'} (${response.status}): ${errText}`
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const stepNativeToolCalls: Array<{
          function?: { name?: string; arguments?: Record<string, unknown> | string };
        }> = [];

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const parsed = JSON.parse(trimmed) as {
                message?: {
                  content?: string;
                  thinking?: string;
                  tool_calls?: Array<{
                    function?: {
                      name?: string;
                      arguments?: Record<string, unknown> | string;
                    };
                  }>;
                };
                done?: boolean;
                eval_count?: number;
                eval_duration?: number;
                prompt_eval_count?: number;
                total_duration?: number;
                error?: string;
              };

              if (parsed.error) {
                throw new Error(parsed.error);
              }

              if (parsed.message?.thinking) {
                stepNativeThinking += parsed.message.thinking;
              }
              if (parsed.message?.content) {
                stepRawContent += parsed.message.content;
              }
              if (
                Array.isArray(parsed.message?.tool_calls) &&
                parsed.message!.tool_calls.length > 0
              ) {
                stepNativeToolCalls.push(...parsed.message!.tool_calls);
              }

              const parsedInline = parseThinkingAndInlineToolCalls(stepRawContent);
              const combinedStepThinking = [stepNativeThinking, parsedInline.thinking]
                .filter(Boolean)
                .join('\n')
                .trim();

              const currentTotalThinking = [totalAccumulatedThinking, combinedStepThinking]
                .filter(Boolean)
                .join('\n\n')
                .trim();

              if (
                typeof parsed.eval_count === 'number' &&
                typeof parsed.eval_duration === 'number' &&
                parsed.eval_duration > 0
              ) {
                const tps = parsed.eval_count / (parsed.eval_duration / 1e9);
                latestStats = {
                  tokensPerSec: Number(tps.toFixed(1)),
                  evalCount: parsed.eval_count,
                  promptEvalCount: parsed.prompt_eval_count,
                  totalDurationMs: parsed.total_duration
                    ? Math.round(parsed.total_duration / 1e6)
                    : Date.now() - generationStartTimeMs,
                };
              } else {
                const elapsedSec = Math.max(0.15, (Date.now() - generationStartTimeMs) / 1000);
                const approxTokens = estimateTokens(
                  (
                    finalVisibleContent +
                    ' ' +
                    parsedInline.visibleContent +
                    ' ' +
                    currentTotalThinking
                  ).trim()
                );
                if (approxTokens > 0) {
                  latestStats = {
                    tokensPerSec: Number((approxTokens / elapsedSec).toFixed(1)),
                    evalCount: approxTokens,
                    totalDurationMs: Math.round(elapsedSec * 1000),
                  };
                }
              }

              assistantMsg.content = mergeVisibleSteps(
                finalVisibleContent,
                parsedInline.visibleContent
              );
              assistantMsg.thinking = currentTotalThinking || undefined;
              assistantMsg.toolCalls = toolTraces.length > 0 ? [...toolTraces] : undefined;
              assistantMsg.stats = latestStats;

              sender.send('chat:stream-chunk', {
                chatId: chat.id,
                messageId: assistantMsgId,
                contentDelta: assistantMsg.content,
                thinkingDelta: currentTotalThinking,
                toolCalls: assistantMsg.toolCalls,
                stats: latestStats,
                done: false,
              });
            } catch (parseErr) {
              if (
                parseErr instanceof Error &&
                !parseErr.message.includes('Unexpected') &&
                !parseErr.message.includes('JSON')
              ) {
                throw parseErr;
              }
            }
          }
        }

        for (const tc of stepNativeToolCalls) {
          const fnName = tc.function?.name;
          if (!fnName) continue;
          let fnArgs: Record<string, unknown> = {};
          if (typeof tc.function?.arguments === 'string') {
            try {
              fnArgs = JSON.parse(tc.function.arguments);
            } catch {
              fnArgs = {};
            }
          } else if (tc.function?.arguments && typeof tc.function.arguments === 'object') {
            fnArgs = tc.function.arguments;
          }
          normalizedCalls.push({ name: fnName, args: fnArgs, isNative: true });
        }

        const finalStepParsed = parseThinkingAndInlineToolCalls(stepRawContent);
        for (const inlineTc of finalStepParsed.inlineToolCalls) {
          normalizedCalls.push({
            name: inlineTc.name,
            args: inlineTc.arguments,
            isNative: false,
          });
        }

        if (normalizedCalls.length > 0) {
          ollamaMessages.push({
            role: 'assistant',
            content: stepRawContent || '',
            ...(stepNativeToolCalls.length > 0 ? { tool_calls: stepNativeToolCalls } : {}),
          });
        }
      }

      const finalStepParsed = parseThinkingAndInlineToolCalls(stepRawContent);
      const stepCombinedThinking = [stepNativeThinking, finalStepParsed.thinking]
        .filter(Boolean)
        .join('\n')
        .trim();
      if (stepCombinedThinking) {
        totalAccumulatedThinking = [totalAccumulatedThinking, stepCombinedThinking]
          .filter(Boolean)
          .join('\n\n')
          .trim();
      }
      if (finalStepParsed.visibleContent) {
        finalVisibleContent = mergeVisibleSteps(
          finalVisibleContent,
          finalStepParsed.visibleContent
        );
      }

      // If no tools were called in this step:
      if (normalizedCalls.length === 0) {
        // Safeguard: If the previous step was interrupted by a tool call (e.g. `rename_chat`)
        // and the model returned 0 tokens in this follow-up step (or left a sentence unfinished),
        // trigger one continuation step without tools so the response never cuts off mid-text.
        const looksCutOffMidSentence =
          interruptedByToolCall &&
          !finalStepParsed.visibleContent.trim() &&
          finalVisibleContent.trim().length > 0;
        const looksEmptyAfterTool =
          interruptedByToolCall && !finalVisibleContent.trim();

        if (!continuationRetried && (looksCutOffMidSentence || looksEmptyAfterTool)) {
          continuationRetried = true;
          interruptedByToolCall = false;
          useNativeTools = false;
          const continuationInstruction = looksEmptyAfterTool
            ? dict.prompts.continuationEmptyAfterTool
            : dict.prompts.continuationCutOffAfterTool;
          if (externalResolved) {
            openAiMessages.push({
              role: 'user',
              content: continuationInstruction,
            });
          } else {
            ollamaMessages.push({
              role: 'user',
              content: continuationInstruction,
            });
          }
          continue;
        }
        break;
      }

      interruptedByToolCall = true;

      // Execute each requested tool call sequentially and stream status to UI
      for (const call of normalizedCalls) {
        const traceId = crypto.randomUUID();
        const trace: ToolExecutionTrace = {
          id: traceId,
          name: call.name,
          args: call.args,
          result: '',
          status: 'running',
          timestamp: formatLocalDateTime(new Date()),
        };
        toolTraces.push(trace);
        assistantMsg.toolCalls = [...toolTraces];

        sender.send('chat:stream-chunk', {
          chatId: chat.id,
          messageId: assistantMsgId,
          contentDelta: finalVisibleContent,
          thinkingDelta: totalAccumulatedThinking,
          toolCalls: assistantMsg.toolCalls,
          done: false,
        });

        let chatTitleUpdated: string | undefined;
        let memoriesChanged = false;

        const toolResultJson = await executeToolCall(call.name, call.args, {
          chatId: chat.id,
          incognito: Boolean(chat.incognito),
          language: settings.language,
          onRenameChat: (newTitle: string) => {
            if (chat) {
              chat = updateUnifiedChat(chat.id, { title: newTitle }) || chat;
            }
            chatTitleUpdated = newTitle;
          },
          onMemoriesModified: () => {
            memoriesChanged = true;
          },
        });

        trace.result = toolResultJson;
        try {
          const parsedRes = JSON.parse(toolResultJson) as { ok?: boolean };
          trace.status = parsedRes.ok === false ? 'error' : 'done';
        } catch {
          trace.status = 'done';
        }

        assistantMsg.toolCalls = [...toolTraces];

        sender.send('chat:stream-chunk', {
          chatId: chat.id,
          messageId: assistantMsgId,
          contentDelta: finalVisibleContent,
          thinkingDelta: totalAccumulatedThinking,
          toolCalls: assistantMsg.toolCalls,
          chatTitleUpdated,
          memoriesChanged,
          done: false,
        });

        const fallbackToolReply = `[${dict.prompts.toolResultFallbackPrefix} ${call.name}]:\n${toolResultJson}\n${dict.prompts.toolResultFallbackSuffix}`;

        // Feed tool result back to the active provider
        if (externalResolved) {
          if (useNativeTools && call.isNative && call.id) {
            openAiMessages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: toolResultJson,
            });
          } else {
            openAiMessages.push({
              role: 'user',
              content: fallbackToolReply,
            });
          }
        } else {
          if (useNativeTools && call.isNative) {
            ollamaMessages.push({
              role: 'tool',
              content: toolResultJson,
            });
          } else {
            ollamaMessages.push({
              role: 'user',
              content: fallbackToolReply,
            });
          }
        }
      }
    }

    // Fallback auto-title if model didn't call `rename_chat` on the very first exchange
    if (
      chat.title === 'Новый диалог' ||
      chat.title === 'Инкогнито чат' ||
      chat.title === 'New Chat' ||
      chat.title === 'Incognito Chat'
    ) {
      const allMsgs = getUnifiedMessages(chat.id);
      if (allMsgs.length <= 2) {
        const fallbackTitle = payload.content.replace(/\s+/g, ' ').trim().slice(0, 44);
        if (fallbackTitle) {
          chat =
            updateUnifiedChat(chat.id, {
              title: fallbackTitle + (payload.content.length > 44 ? '…' : ''),
            }) || chat;
        }
      }
    }

    assistantMsg.content =
      finalVisibleContent ||
      (toolTraces.length > 0
        ? isEn
          ? 'Done (tool calls executed).'
          : 'Готово (выполнены вызовы функций).'
        : '');
    assistantMsg.thinking = totalAccumulatedThinking || undefined;
    assistantMsg.toolCalls = toolTraces.length > 0 ? toolTraces : undefined;
    assistantMsg.stats = latestStats;

    saveUnifiedMessage(chat, assistantMsg);
    activeGenerations.delete(chat.id);

    sender.send('chat:stream-chunk', {
      chatId: chat.id,
      messageId: assistantMsgId,
      contentDelta: assistantMsg.content,
      thinkingDelta: assistantMsg.thinking || '',
      toolCalls: assistantMsg.toolCalls,
      stats: assistantMsg.stats,
      chatTitleUpdated: chat.title,
      done: true,
    });

    if (settings.enableNotifications !== false) {
      triggerCompletionNotification(
        sender,
        chat.title,
        assistantMsg.content,
        settings.language || 'ru'
      );
    }

    return {
      ok: true,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      chat: getUnifiedChat(chat.id),
    };
  } catch (err: unknown) {
    activeGenerations.delete(chat.id);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    if (isAbort) {
      if (!assistantMsg.content) {
        assistantMsg.content = isEn
          ? '*(Generation stopped by user)*'
          : '*(Генерация остановлена пользователем)*';
      }
      saveUnifiedMessage(chat, assistantMsg);
      sender.send('chat:stream-chunk', {
        chatId: chat.id,
        messageId: assistantMsgId,
        contentDelta: assistantMsg.content,
        thinkingDelta: assistantMsg.thinking || '',
        toolCalls: assistantMsg.toolCalls,
        done: true,
      });
      return {
        ok: true,
        aborted: true,
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        chat: getUnifiedChat(chat.id),
      };
    }

    const errorMessage =
      err instanceof Error
        ? err.message
        : isEn
          ? 'Unknown generation error'
          : 'Неизвестная ошибка генерации';
    const targetLabel = externalResolved ? externalResolved.provider.name : 'Ollama';
    assistantMsg.content = isEn
      ? `⚠️ **Error communicating with ${targetLabel}:** ${errorMessage}`
      : `⚠️ **Ошибка при обращении к ${targetLabel}:** ${errorMessage}`;
    saveUnifiedMessage(chat, assistantMsg);

    sender.send('chat:stream-chunk', {
      chatId: chat.id,
      messageId: assistantMsgId,
      contentDelta: assistantMsg.content,
      toolCalls: assistantMsg.toolCalls,
      error: errorMessage,
      done: true,
    });

    return {
      ok: false,
      error: errorMessage,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      chat: getUnifiedChat(chat.id),
    };
  }
}
