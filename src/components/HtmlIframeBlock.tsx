import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Code2,
  Eye,
  Send,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  CheckCircle2,
} from 'lucide-react';
import { buildIframeSrcDoc } from '../utils/iframeTemplate';
import { useI18n } from '../i18n';

interface HtmlIframeBlockProps {
  htmlCode: string;
  isInteractiveWidget?: boolean;
  isDark: boolean;
  onSubmitWidgetResponse?: (formattedUserReply: string) => void;
}

export const HtmlIframeBlock: React.FC<HtmlIframeBlockProps> = ({
  htmlCode,
  isInteractiveWidget = false,
  isDark,
  onSubmitWidgetResponse,
}) => {
  const { t } = useI18n();
  const frameId = useId();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [iframeHeight, setIframeHeight] = useState<number>(isInteractiveWidget ? 240 : 280);
  const [expanded, setExpanded] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Notify live iframe when app theme toggles between light/dark so internal scripts & CSS vars update without losing state
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'APP_THEME_CHANGE',
        frameId,
        isDark,
        theme: isDark ? 'dark' : 'light',
      },
      '*'
    );
  }, [isDark, frameId]);

  const initialThemeRef = useRef(isDark);

  const srcDoc = useMemo(
    () =>
      buildIframeSrcDoc(htmlCode, frameId, initialThemeRef.current, {
        fieldFallbackPrefix: t.iframe.fieldFallbackPrefix,
        yesValue: t.iframe.yesValue,
        yesCheckedValue: t.iframe.yesCheckedValue,
        noValue: t.iframe.noValue,
        nothingSelectedValue: t.iframe.nothingSelectedValue,
        selectedValue: t.iframe.selectedValue,
        notSelectedValue: t.iframe.notSelectedValue,
      }),
    [htmlCode, frameId, t.iframe]
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.frameId !== frameId) return;

      if (data.type === 'OLLAMA_IFRAME_HEIGHT' && typeof data.height === 'number') {
        const clamped = Math.min(Math.max(data.height, 95), expanded ? 780 : 460);
        setIframeHeight(clamped);
      } else if (data.type === 'OLLAMA_OPEN_EXTERNAL_URL' && typeof data.url === 'string') {
        window.electronAPI.openExternalUrl(data.url);
      } else if (data.type === 'OLLAMA_WIDGET_SUBMIT_DATA' && Array.isArray(data.entries)) {
        if (!onSubmitWidgetResponse) return;
        const entries: Array<{ label: string; value: string }> = data.entries;
        const formatted =
          entries.length === 0
            ? t.iframe.defaultFormSubmitted
            : `${t.iframe.formResponseHeader}\n` +
              entries.map((item) => `- **${item.label}:** ${item.value}`).join('\n');
        setSubmitted(true);
        onSubmitWidgetResponse(formatted);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [frameId, expanded, onSubmitWidgetResponse, t.iframe]);

  const triggerWidgetSubmit = () => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'REQUEST_WIDGET_DATA',
        frameId,
      },
      '*'
    );
  };

  return (
    <div className="my-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden transition-all shadow-sm">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-100/80 dark:bg-neutral-900 text-xs">
        <div className="flex items-center gap-2 font-medium text-neutral-700 dark:text-neutral-300">
          {isInteractiveWidget ? (
            <>
              <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500" />
              <span>{t.iframe.interactiveWidgetTitle}</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-neutral-500" />
              <span>{t.iframe.htmlPreviewTitle}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'preview' ? 'code' : 'preview')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors"
            title={t.iframe.toggleViewTooltip}
          >
            {viewMode === 'preview' ? (
              <>
                <Code2 className="w-3.5 h-3.5" />
                <span>{t.iframe.codeBtn}</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>{t.iframe.iframeBtn}</span>
              </>
            )}
          </button>

          {viewMode === 'preview' && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded-md text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors"
              title={expanded ? t.iframe.collapseHeightTooltip : t.iframe.expandHeightTooltip}
            >
              {expanded ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {viewMode === 'preview' ? (
        <div className="w-full bg-white dark:bg-neutral-900">
          <iframe
            ref={iframeRef}
            title={isInteractiveWidget ? 'Interactive Widget' : 'HTML Block Preview'}
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-forms"
            style={{ height: `${iframeHeight}px` }}
            className="w-full border-0 transition-[height] duration-150"
          />
        </div>
      ) : (
        <pre className="p-3.5 text-xs font-mono overflow-x-auto bg-neutral-950 text-neutral-100 max-h-96">
          <code>{htmlCode}</code>
        </pre>
      )}

      {/* Footer Submit Bar for interactive widgets or forms */}
      {isInteractiveWidget && onSubmitWidgetResponse && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-100/70 dark:bg-neutral-800/40 border-t border-neutral-200/80 dark:border-neutral-800">
          <span className="text-xs text-neutral-600 dark:text-neutral-400">
            {submitted ? t.iframe.submittedHint : t.iframe.fillFormHint}
          </span>
          <button
            type="button"
            onClick={triggerWidgetSubmit}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 shadow-sm transition-all"
          >
            {submitted ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t.iframe.resubmitBtn}</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{t.iframe.submitToChatBtn}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
