import React, { useState } from 'react';
import { Trash2, Check, Pencil, Wand2 } from 'lucide-react';
import type { SkillRecord } from '../../types/chat';
import { useI18n } from '../../i18n';

interface SkillsSettingsTabProps {
  skills: SkillRecord[];
  onSaveSkill: (
    skill: Omit<SkillRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  onDeleteSkill: (id: string) => Promise<void>;
}

export const SkillsSettingsTab: React.FC<SkillsSettingsTabProps> = ({
  skills,
  onSaveSkill,
  onDeleteSkill,
}) => {
  const { t } = useI18n();
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [skillSlug, setSkillSlug] = useState('');
  const [skillName, setSkillName] = useState('');
  const [skillDesc, setSkillDesc] = useState('');
  const [skillInstructions, setSkillInstructions] = useState('');

  const resetSkillForm = () => {
    setEditingSkillId(null);
    setSkillSlug('');
    setSkillName('');
    setSkillDesc('');
    setSkillInstructions('');
  };

  const startEditSkill = (s: SkillRecord) => {
    setEditingSkillId(s.id);
    setSkillSlug(s.slug);
    setSkillName(s.name);
    setSkillDesc(s.description);
    setSkillInstructions(s.instructions);
  };

  const handleSaveSkillForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillSlug.trim() || !skillName.trim() || !skillInstructions.trim()) return;
    await onSaveSkill({
      id: editingSkillId || undefined,
      slug: skillSlug.trim(),
      name: skillName.trim(),
      description: skillDesc.trim(),
      instructions: skillInstructions.trim(),
      enabled: true,
    });
    resetSkillForm();
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 text-neutral-600 dark:text-neutral-400 leading-relaxed">
        {t.settings.skills.intro}
      </div>

      {/* Add / Edit Skill Form */}
      <form
        onSubmit={handleSaveSkillForm}
        className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 space-y-2.5"
      >
        <div className="flex items-center justify-between">
          <span className="font-medium text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5" />
            <span>
              {editingSkillId ? t.settings.skills.editTitle : t.settings.skills.createTitle}
            </span>
          </span>
          {editingSkillId && (
            <button
              type="button"
              onClick={resetSkillForm}
              className="text-[11px] text-neutral-500 underline"
            >
              {t.settings.skills.cancelEdit}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="flex items-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2.5">
            <span className="text-neutral-400 font-mono">/</span>
            <input
              type="text"
              value={skillSlug}
              onChange={(e) => setSkillSlug(e.target.value)}
              placeholder={t.settings.skills.slugPlaceholder}
              className="w-full py-1.5 pl-1 bg-transparent font-mono focus:outline-none"
              required
            />
          </div>
          <input
            type="text"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            placeholder={t.settings.skills.namePlaceholder}
            className="sm:col-span-2 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
            required
          />
        </div>

        <input
          type="text"
          value={skillDesc}
          onChange={(e) => setSkillDesc(e.target.value)}
          placeholder={t.settings.skills.descPlaceholder}
          className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        />

        <textarea
          rows={3}
          value={skillInstructions}
          onChange={(e) => setSkillInstructions(e.target.value)}
          placeholder={t.settings.skills.instructionsPlaceholder}
          className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono text-[11px]"
          required
        />

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 font-medium inline-flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>
              {editingSkillId ? t.settings.skills.saveChangesBtn : t.settings.skills.addSkillBtn}
            </span>
          </button>
        </div>
      </form>

      {/* Skills List */}
      <div className="space-y-2">
        {skills.map((sk) => (
          <div
            key={sk.id}
            className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/50 flex items-start justify-between gap-3"
          >
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-neutral-200/80 dark:bg-neutral-800 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                  /{sk.slug}
                </span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {sk.name}
                </span>
                {sk.builtin && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    {t.settings.skills.builtinBadge}
                  </span>
                )}
              </div>
              <p className="text-neutral-500 dark:text-neutral-400">{sk.description}</p>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <input
                type="checkbox"
                checked={sk.enabled}
                onChange={(e) =>
                  onSaveSkill({
                    id: sk.id,
                    slug: sk.slug,
                    name: sk.name,
                    description: sk.description,
                    instructions: sk.instructions,
                    builtin: sk.builtin,
                    enabled: e.target.checked,
                  })
                }
                className="w-3.5 h-3.5 accent-neutral-800 dark:accent-neutral-200 mr-1 cursor-pointer"
                title={t.settings.skills.toggleTooltip}
              />
              <button
                type="button"
                onClick={() => startEditSkill(sk)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
                title={t.settings.skills.editTooltip}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteSkill(sk.id)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
                title={t.settings.skills.deleteTooltip}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
