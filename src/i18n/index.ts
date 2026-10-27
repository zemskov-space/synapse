import React, { createContext, useContext } from 'react';
import type { LanguageCode } from '../types/chat';
import { ru, type TranslationDictionary } from './locales/ru';
import { en } from './locales/en';

export type { TranslationDictionary };

export interface SupportedLanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguageInfo[] = [
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'en', name: 'English', nativeName: 'English' },
];

const LOCALES: Record<LanguageCode, TranslationDictionary> = {
  ru,
  en,
};

export function getTranslationDictionary(language?: LanguageCode): TranslationDictionary {
  return LOCALES[language || 'ru'] || ru;
}

interface I18nContextValue {
  language: LanguageCode;
  t: TranslationDictionary;
}

const I18nContext = createContext<I18nContextValue>({
  language: 'ru',
  t: ru,
});

export const I18nProvider: React.FC<{
  language: LanguageCode;
  children: React.ReactNode;
}> = ({ language, children }) => {
  const dict = getTranslationDictionary(language);
  return React.createElement(
    I18nContext.Provider,
    { value: { language: language || 'ru', t: dict } },
    children
  );
};

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
