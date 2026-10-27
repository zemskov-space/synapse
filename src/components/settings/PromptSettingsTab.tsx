import React from 'react';
import { useI18n } from '../../i18n';

interface PromptSettingsTabProps {
  customPrompt: string;
  onCustomPromptChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const PromptSettingsTab: React.FC<PromptSettingsTabProps> = ({
  customPrompt,
  onCustomPromptChange,
  onSubmit,
}) => {
  const { t } = useI18n();

  return (
    <form id="settings-form" onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
          {t.settings.prompt.customLabel}
        </label>
        <textarea
          rows={4}
          value={customPrompt}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          placeholder={t.settings.prompt.customPlaceholder}
          className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500"
        />
      </div>

      <div>
        <div className="font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
          {t.settings.prompt.baseLabel}
        </div>
        <pre className="p-3 rounded-xl bg-neutral-950 text-neutral-300 text-[11px] font-mono whitespace-pre-wrap max-h-56 overflow-y-auto border border-neutral-800">
          {t.prompts.baseSystemPrompt}
        </pre>
      </div>
    </form>
  );
};
