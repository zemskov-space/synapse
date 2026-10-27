import type {
  AppSettings,
  ChatRecord,
  LanguageCode,
  SkillRecord,
} from '../../src/types/chat';
import { getTranslationDictionary } from '../../src/i18n';
import { listUserMemories } from '../db';
import { getMcpServersStatus } from '../mcp';
import { formatLocalDateTime } from './ollamaService';

/**
 * Extracts `<think>...</think>` blocks and any inline ```tool_call ... ``` blocks (for models that emit JSON tool calls in text).
 */
export function parseThinkingAndInlineToolCalls(rawText: string): {
  thinking: string;
  visibleContent: string;
  inlineToolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
} {
  const thinkingParts: string[] = [];
  let contentWithoutThink = rawText;

  // 1. Extract all closed <think>...</think> blocks
  const closedThinkRegex = /<think>([\s\S]*?)<\/think>/gi;
  contentWithoutThink = contentWithoutThink.replace(
    closedThinkRegex,
    (_fullMatch, inner: string) => {
      const trimmed = inner.trim();
      if (trimmed) {
        thinkingParts.push(trimmed);
      }
      return '';
    }
  );

  // 2. Extract any trailing unclosed <think>... block while streaming
  const unclosedThinkMatch = /<think>([\s\S]*)$/i.exec(contentWithoutThink);
  if (unclosedThinkMatch) {
    const trailingThought = unclosedThinkMatch[1].trimStart();
    if (trailingThought) {
      thinkingParts.push(trailingThought);
    }
    contentWithoutThink = contentWithoutThink.slice(0, unclosedThinkMatch.index);
  }

  const thinking = thinkingParts.join('\n\n').trim();

  // 3. Extract inline ```tool_call ... ``` blocks
  const inlineToolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
  const toolBlockRegex = /```tool_call\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = toolBlockRegex.exec(contentWithoutThink)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as {
        name?: string;
        arguments?: Record<string, unknown>;
      };
      if (parsed && typeof parsed.name === 'string') {
        inlineToolCalls.push({
          name: parsed.name,
          arguments: parsed.arguments || {},
        });
      }
    } catch {
      // ignore invalid JSON tool call
    }
  }

  contentWithoutThink = contentWithoutThink.replace(toolBlockRegex, '');
  // Hide incomplete trailing ```tool_call block while streaming (only if no closing ``` exists after it)
  contentWithoutThink = contentWithoutThink.replace(/```tool_call(?![\s\S]*```)[\s\S]*$/i, '');

  return {
    thinking,
    visibleContent: contentWithoutThink.trim(),
    inlineToolCalls,
  };
}

export function formatMemoriesForPrompt(language: LanguageCode = 'ru'): string {
  const p = getTranslationDictionary(language).prompts;
  const memories = listUserMemories();
  if (memories.length === 0) {
    return p.memoriesEmpty;
  }
  const lines = memories.map((m) => {
    const createdLocal = formatLocalDateTime(new Date(m.createdAt));
    const updatedLocal = formatLocalDateTime(new Date(m.updatedAt));
    return `- [id: "${m.id}" | ${p.memoryCreatedLabel}: ${createdLocal} | ${p.memoryUpdatedLabel}: ${updatedLocal}] ${m.content}`;
  });
  return `${p.memoriesHeader}\n${lines.join('\n')}`;
}

export function buildSystemPromptText(
  currentChat: ChatRecord,
  settings: AppSettings,
  allSkills: SkillRecord[],
  triggeredSkills: SkillRecord[]
): string {
  const lang: LanguageCode = settings.language || 'ru';
  const p = getTranslationDictionary(lang).prompts;

  const memorySection = formatMemoriesForPrompt(lang);
  const incognitoPolicy = currentChat.incognito
    ? `${p.incognitoPolicyActivePrefix} "${currentChat.title}". ${p.incognitoPolicyActiveSuffix}`
    : `${p.incognitoPolicyNormalPrefix} "${currentChat.title}". ${p.incognitoPolicyNormalSuffix}`;

  const mcpStatuses = getMcpServersStatus().filter((s) => s.status === 'connected');
  const mcpSummary =
    mcpStatuses.length > 0
      ? `${p.mcpServersHeader}\n` +
        mcpStatuses
          .map(
            (s) =>
              `- ${p.mcpServerLabel} "${s.name}": ${
                s.tools.map((t) => `mcp__${s.id.slice(0, 8)}__${t.name}`).join(', ') ||
                p.mcpNoTools
              }`
          )
          .join('\n')
      : '';

  const skillsCatalog =
    allSkills.length > 0
      ? `${p.availableSkillsHeader}\n` +
        allSkills.map((s) => `- /${s.slug} (${s.name}): ${s.description}`).join('\n')
      : '';

  const activeSkillsInstructions =
    triggeredSkills.length > 0
      ? `${p.activeSkillsHeader}\n\n` +
        triggeredSkills
          .map((s) => `=== ${p.skillLabel} /${s.slug}: ${s.name} ===\n${s.instructions}`)
          .join('\n\n')
      : '';

  const parts = [
    p.baseSystemPrompt,
    `${p.currentSystemTimeLabel} [${formatLocalDateTime(new Date())}].`,
    memorySection,
    incognitoPolicy,
    mcpSummary,
    skillsCatalog,
    activeSkillsInstructions,
  ].filter(Boolean);

  if (settings.customSystemPromptAddon?.trim()) {
    parts.push(`${p.customInstructionsHeader}\n${settings.customSystemPromptAddon.trim()}`);
  }
  if (currentChat.compressedSummary?.trim()) {
    parts.push(`${p.compressedSummaryHeader}\n${currentChat.compressedSummary.trim()}`);
  }
  return parts.join('\n\n');
}
