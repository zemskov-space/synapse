import React, { useMemo } from 'react';
import { marked } from 'marked';
import { HtmlIframeBlock } from './HtmlIframeBlock';
import { highlightCodeToHtml } from '../utils/syntaxHighlight';
import { useI18n } from '../i18n';

interface MarkdownContentProps {
  content: string;
  isDark: boolean;
  onSubmitWidgetResponse?: (formattedUserReply: string) => void;
}

interface ContentSegment {
  type: 'markdown' | 'html-iframe' | 'html-widget';
  content: string;
}

/**
 * Splits markdown content into standard markdown segments and special ```html / ```html-widget blocks
 * so that HTML blocks render directly as live sandboxed iframes.
 */
function parseSegments(raw: string): ContentSegment[] {
  if (!raw) return [];

  const segments: ContentSegment[] = [];
  const fenceRegex = /```(html-widget|html-interactive|widget|html)\s*\n([\s\S]*?)```/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'markdown',
        content: raw.slice(lastIndex, match.index),
      });
    }

    const lang = match[1].toLowerCase();
    const code = match[2].trim();

    const hasInteractiveControls = /<(input|select|textarea|form)\b/i.test(code);
    const isWidget =
      lang === 'html-widget' ||
      lang === 'html-interactive' ||
      lang === 'widget' ||
      hasInteractiveControls;

    segments.push({
      type: isWidget ? 'html-widget' : 'html-iframe',
      content: code,
    });

    lastIndex = fenceRegex.lastIndex;
  }

  if (lastIndex < raw.length) {
    segments.push({
      type: 'markdown',
      content: raw.slice(lastIndex),
    });
  }

  return segments;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  isDark,
  onSubmitWidgetResponse,
}) => {
  const { t } = useI18n();
  const segments = useMemo(() => parseSegments(content), [content]);

  const markedRenderer = useMemo(() => {
    const renderer = new marked.Renderer();
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      const cleanLang = (lang || 'code').trim().split(/\s+/)[0] || 'code';
      const highlighted = highlightCodeToHtml(text, cleanLang);
      const encodedRaw = encodeURIComponent(text);
      return `<div class="code-block-wrapper">
        <div class="code-block-header">
          <span class="uppercase tracking-wider text-[10px] font-semibold text-neutral-400">${cleanLang}</span>
          <button type="button" class="code-block-copy-btn" data-copy-code="${encodedRaw}" data-copied-label="${t.common.copied}" data-copy-label="${t.common.copy}">
            <span>${t.common.copy}</span>
          </button>
        </div>
        <pre><code class="language-${cleanLang}">${highlighted}</code></pre>
      </div>`;
    };
    return renderer;
  }, [t.common.copy, t.common.copied]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;

    // Handle Code Block Copy Button
    const copyBtn = target?.closest<HTMLButtonElement>('[data-copy-code]');
    if (copyBtn) {
      e.preventDefault();
      const rawEncoded = copyBtn.getAttribute('data-copy-code');
      const copiedLabel = copyBtn.getAttribute('data-copied-label') || 'Copied!';
      const copyLabel = copyBtn.getAttribute('data-copy-label') || 'Copy';
      if (rawEncoded) {
        try {
          const decoded = decodeURIComponent(rawEncoded);
          navigator.clipboard.writeText(decoded);
          const span = copyBtn.querySelector('span');
          if (span) {
            span.textContent = `✓ ${copiedLabel}`;
            setTimeout(() => {
              span.textContent = copyLabel;
            }, 1800);
          }
        } catch {
          // ignore
        }
      }
      return;
    }

    // Handle External Links
    const anchor = target?.closest('a');
    if (anchor && anchor.href && /^https?:\/\//i.test(anchor.href)) {
      e.preventDefault();
      window.electronAPI.openExternalUrl(anchor.href);
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className="space-y-2.5 leading-relaxed text-[14.5px] break-words"
    >
      {segments.map((seg, index) => {
        if (seg.type === 'html-widget' || seg.type === 'html-iframe') {
          return (
            <HtmlIframeBlock
              key={`iframe-${index}`}
              htmlCode={seg.content}
              isInteractiveWidget={seg.type === 'html-widget'}
              isDark={isDark}
              onSubmitWidgetResponse={onSubmitWidgetResponse}
            />
          );
        }

        const html = marked.parse(seg.content, {
          gfm: true,
          breaks: true,
          renderer: markedRenderer,
        }) as string;

        return (
          <div
            key={`md-${index}`}
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
};
