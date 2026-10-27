import React, { useState } from 'react';
import { Plus, Trash2, Check, Pencil } from 'lucide-react';
import type { UserMemoryItem } from '../../types/chat';
import { useI18n } from '../../i18n';

interface MemorySettingsTabProps {
  memories: UserMemoryItem[];
  onAddMemory: (content: string) => Promise<void>;
  onUpdateMemory: (id: string, content: string) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  onClearMemories: () => Promise<void>;
}

export const MemorySettingsTab: React.FC<MemorySettingsTabProps> = ({
  memories,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
  onClearMemories,
}) => {
  const { t } = useI18n();
  const [newMemoryText, setNewMemoryText] = useState('');
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryValue, setEditingMemoryValue] = useState('');

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim()) return;
    await onAddMemory(newMemoryText.trim());
    setNewMemoryText('');
  };

  const startEditingMemory = (item: UserMemoryItem) => {
    setEditingMemoryId(item.id);
    setEditingMemoryValue(item.content);
  };

  const saveEditedMemory = async (id: string) => {
    if (editingMemoryValue.trim()) {
      await onUpdateMemory(id, editingMemoryValue.trim());
    }
    setEditingMemoryId(null);
    setEditingMemoryValue('');
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 text-neutral-600 dark:text-neutral-400 leading-relaxed">
        {t.settings.memory.intro}
      </div>

      <form onSubmit={handleCreateMemory} className="flex gap-2">
        <input
          type="text"
          value={newMemoryText}
          onChange={(e) => setNewMemoryText(e.target.value)}
          placeholder={t.settings.memory.placeholder}
          className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500"
        />
        <button
          type="submit"
          className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 font-medium inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.common.add}</span>
        </button>
      </form>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {memories.length === 0 ? (
          <div className="py-10 text-center text-neutral-400 dark:text-neutral-500">
            {t.settings.memory.empty}
          </div>
        ) : (
          memories.map((item) => {
            const isEditing = editingMemoryId === item.id;
            return (
              <div
                key={item.id}
                className="flex items-start justify-between gap-2.5 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40"
              >
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editingMemoryValue}
                      onChange={(e) => setEditingMemoryValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditedMemory(item.id);
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => saveEditedMemory(item.id)}
                      className="p-1.5 rounded-lg bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-neutral-800 dark:text-neutral-200 leading-relaxed break-words">
                        {item.content}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-neutral-400 font-mono">
                        <span>id: {item.id.slice(0, 8)}…</span>
                        <span>
                          {t.settings.memory.created}{' '}
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                        <span>
                          {t.settings.memory.updated}{' '}
                          {new Date(item.updatedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditingMemory(item)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMemory(item.id)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {memories.length > 0 && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClearMemories}
            className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline"
          >
            {t.settings.memory.clearAll}
          </button>
        </div>
      )}
    </div>
  );
};
