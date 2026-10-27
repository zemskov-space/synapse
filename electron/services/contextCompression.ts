import type { AppSettings, ChatRecord } from '../../src/types/chat';
import { getTranslationDictionary } from '../../src/i18n';
import {
  getUnifiedChat,
  getUnifiedMessages,
  markUnifiedMessagesCompressed,
  updateUnifiedChat,
} from './chatStore';
import {
  buildOllamaHeaders,
  estimateTokens,
  fetchModelContextLength,
} from './ollamaService';
import {
  buildOpenAiHeaders,
  normalizeOpenAiBaseUrl,
  resolveExternalProvider,
} from './openaiService';

export async function maybeCompressContext(
  chat: ChatRecord,
  settings: AppSettings,
  sender: Electron.WebContents
): Promise<ChatRecord> {
  const dict = getTranslationDictionary(settings.language);
  const p = dict.prompts;

  const allMessages = getUnifiedMessages(chat.id);
  const activeMessages = allMessages.filter((m) => !m.isCompressed);

  const contextLimit = await fetchModelContextLength(
    settings.ollamaHost,
    chat.model,
    settings.ollamaApiKey
  );
  if (chat.contextLimit !== contextLimit) {
    updateUnifiedChat(chat.id, { contextLimit });
    chat.contextLimit = contextLimit;
  }

  const effectiveMaxTokens = Math.min(contextLimit, 32768);
  const thresholdTokens = Math.floor(effectiveMaxTokens * settings.compressionThresholdRatio);

  const systemTokens = estimateTokens(
    p.baseSystemPrompt + '\n' + (settings.customSystemPromptAddon || '')
  );
  const summaryTokens = estimateTokens(chat.compressedSummary || '');
  const activeMessageTokens = activeMessages.reduce(
    (acc, m) => acc + estimateTokens(`[${m.formattedTime}] ${m.role}: ${m.content}`),
    0
  );

  const totalEstimatedTokens = systemTokens + summaryTokens + activeMessageTokens;

  const keepCount = Math.max(2, settings.keepRecentMessages || 6);
  if (totalEstimatedTokens <= thresholdTokens || activeMessages.length <= keepCount + 1) {
    return chat;
  }

  const messagesToCompress = activeMessages.slice(0, activeMessages.length - keepCount);
  if (messagesToCompress.length === 0) return chat;

  sender.send('chat:stream-chunk', {
    chatId: chat.id,
    messageId: 'system-compression',
    compressionNotice: `${p.compressionNoticePrefix} (${messagesToCompress.length} ${p.compressionNoticeMessagesUnit}, ~${totalEstimatedTokens} ${p.compressionNoticeTokensUnit})...`,
  });

  const transcriptToSummarize = messagesToCompress
    .map(
      (m) =>
        `[${m.formattedTime}] ${
          m.role === 'user' ? p.compressionUserRole : p.compressionAssistantRole
        }:\n${m.content}`
    )
    .join('\n\n---\n\n');

  const promptContent = [
    chat.compressedSummary
      ? `${p.compressionPreviousSummaryHeader}\n${chat.compressedSummary}\n\n`
      : '',
    `${p.compressionNewMessagesHeader}\n${transcriptToSummarize}`,
  ].join('');

  try {
    let newSummary = '';
    const externalProvider = resolveExternalProvider(chat.model);

    if (externalProvider) {
      const root = normalizeOpenAiBaseUrl(externalProvider.provider.baseUrl);
      const res = await fetch(`${root}/chat/completions`, {
        method: 'POST',
        headers: buildOpenAiHeaders(externalProvider.provider.apiKey),
        body: JSON.stringify({
          model: externalProvider.modelId,
          stream: false,
          messages: [
            { role: 'system', content: p.contextCompressionPrompt },
            { role: 'user', content: promptContent },
          ],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        newSummary = (data.choices?.[0]?.message?.content || '').trim();
      }
    } else {
      const host = settings.ollamaHost.replace(/\/$/, '');
      const res = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: buildOllamaHeaders(settings.ollamaApiKey, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: chat.model,
          stream: false,
          messages: [
            { role: 'system', content: p.contextCompressionPrompt },
            { role: 'user', content: promptContent },
          ],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { message?: { content?: string } };
        newSummary = (data.message?.content || '').trim();
      }
    }

    newSummary = newSummary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (newSummary) {
      const lastCompressed = messagesToCompress[messagesToCompress.length - 1];
      markUnifiedMessagesCompressed(
        chat,
        messagesToCompress.map((m) => m.id),
        newSummary,
        lastCompressed.id
      );
      const refreshed = getUnifiedChat(chat.id) || chat;
      sender.send('chat:stream-chunk', {
        chatId: chat.id,
        messageId: 'system-compression',
        compressionNotice: '',
      });
      return refreshed;
    }
  } catch (err) {
    console.error('Context compression failed, continuing with uncompressed messages:', err);
  }

  sender.send('chat:stream-chunk', {
    chatId: chat.id,
    messageId: 'system-compression',
    compressionNotice: '',
  });
  return chat;
}
