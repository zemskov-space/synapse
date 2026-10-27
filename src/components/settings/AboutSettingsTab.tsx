import React, { useRef, useState } from 'react';
import {
  Database,
  Ghost,
  Blocks,
  Wand2,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import appIcon from '../../../assets/icons/ui-icon.png';
import { useI18n } from '../../i18n';

interface AboutSettingsTabProps {
  onUnlockDatabaseEditor: () => void;
}

const REQUIRED_TAPS = 5;

export const AboutSettingsTab: React.FC<AboutSettingsTabProps> = ({
  onUnlockDatabaseEditor,
}) => {
  const { t } = useI18n();
  const [tapCount, setTapCount] = useState(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVersionTap = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    const nextCount = tapCount + 1;
    if (nextCount >= REQUIRED_TAPS) {
      setTapCount(0);
      onUnlockDatabaseEditor();
      return;
    }

    setTapCount(nextCount);
    resetTimerRef.current = setTimeout(() => {
      setTapCount(0);
    }, 2200);
  };

  const remainingTaps = REQUIRED_TAPS - tapCount;

  return (
    <div className="space-y-4">
      {/* Main Brand & Version Card */}
      <div className="p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img
            src={appIcon}
            alt="Synapse"
            className="w-12 h-12 rounded-2xl object-cover shadow-sm flex-shrink-0"
          />
          <div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Synapse
              </h3>
              <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
                by zemskov.space
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t.settings.about.subtitle}
            </p>
          </div>
        </div>

        {/* Clickable App Version Badge (5 taps unlocks DB Editor) */}
        <div className="flex flex-col items-end gap-1 self-end sm:self-center select-none">
          <button
            type="button"
            onClick={handleVersionTap}
            className="px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 active:scale-[0.98] transition-all text-left cursor-pointer"
          >
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-medium">
              {t.settings.about.versionLabel}
            </div>
            <div className="text-xs font-mono font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
              v1.0.0 (Local Edition)
            </div>
          </button>

          {tapCount >= 2 && (
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
              {t.settings.about.tapsRemaining} {remainingTaps}
            </span>
          )}
        </div>
      </div>

      {/* Capabilities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/40 space-y-1">
          <div className="flex items-center gap-2 font-medium text-neutral-800 dark:text-neutral-200">
            <Database className="w-3.5 h-3.5 text-neutral-500" />
            <span>{t.settings.about.cardSqliteTitle}</span>
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t.settings.about.cardSqliteDesc}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/40 space-y-1">
          <div className="flex items-center gap-2 font-medium text-neutral-800 dark:text-neutral-200">
            <Ghost className="w-3.5 h-3.5 text-neutral-500" />
            <span>{t.settings.about.cardIncognitoTitle}</span>
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t.settings.about.cardIncognitoDesc}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/40 space-y-1">
          <div className="flex items-center gap-2 font-medium text-neutral-800 dark:text-neutral-200">
            <Blocks className="w-3.5 h-3.5 text-neutral-500" />
            <span>{t.settings.about.cardMcpTitle}</span>
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t.settings.about.cardMcpDesc}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/40 space-y-1">
          <div className="flex items-center gap-2 font-medium text-neutral-800 dark:text-neutral-200">
            <Wand2 className="w-3.5 h-3.5 text-neutral-500" />
            <span>{t.settings.about.cardSkillsTitle}</span>
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t.settings.about.cardSkillsDesc}
          </p>
        </div>
      </div>

      {/* Privacy & Architecture Footer Note */}
      <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 flex items-center justify-between gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-neutral-500 flex-shrink-0" />
          <span>{t.settings.about.footerPrivacy}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-neutral-400">
          <Cpu className="w-3.5 h-3.5" />
          <span>Electron • React • SQLite WASM</span>
        </span>
      </div>
    </div>
  );
};
