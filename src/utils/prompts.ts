import type { LanguageCode } from '../types/chat';
import { getTranslationDictionary } from '../i18n';

export function getBaseSystemPrompt(language: LanguageCode = 'ru'): string {
  return getTranslationDictionary(language).prompts.baseSystemPrompt;
}

export function getContextCompressionPrompt(language: LanguageCode = 'ru'): string {
  return getTranslationDictionary(language).prompts.contextCompressionPrompt;
}
