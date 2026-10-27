export interface IframeWidgetLabels {
  fieldFallbackPrefix: string;
  yesValue: string;
  yesCheckedValue: string;
  noValue: string;
  nothingSelectedValue: string;
  selectedValue: string;
  notSelectedValue: string;
}

const DEFAULT_LABELS: IframeWidgetLabels = {
  fieldFallbackPrefix: 'Field',
  yesValue: 'Yes',
  yesCheckedValue: 'Yes (checked)',
  noValue: 'No',
  nothingSelectedValue: 'None selected',
  selectedValue: 'Selected',
  notSelectedValue: 'Not selected',
};

/**
 * Builds the sandboxed HTML document for `HtmlIframeBlock`, including:
 * - Adaptive CSS custom properties (`--app-bg`, `--app-surface`, etc.) matching light/dark theme
 * - Pre-built utility classes (`.app-card`, `.app-btn`, `.app-badge`, `.app-grid`)
 * - Auto-resizing via `ResizeObserver` (`OLLAMA_IFRAME_HEIGHT`)
 * - Interactive form values collector (`window.submitWidget` / `OLLAMA_WIDGET_SUBMIT_DATA`)
 * - External link interceptor (`OLLAMA_OPEN_EXTERNAL_URL`)
 * - Live theme synchronization (`APP_THEME_CHANGE`)
 */
export function buildIframeSrcDoc(
  htmlCode: string,
  frameId: string,
  startDark: boolean,
  labels: IframeWidgetLabels = DEFAULT_LABELS
): string {
  const initialTheme = startDark ? 'dark' : 'light';

  return `<!DOCTYPE html>
<html data-theme="${initialTheme}" class="${initialTheme}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root, html[data-theme="light"] {
      color-scheme: light;
      --app-bg: #ffffff;
      --app-surface: #f5f5f5;
      --app-surface-elevated: #ebebeb;
      --app-text: #171717;
      --app-text-muted: #737373;
      --app-border: #e5e5e5;
      --app-border-strong: #a3a3a3;
      --app-accent: #171717;
      --app-accent-fg: #ffffff;
      --app-code-bg: #f0f0f0;
      --app-radius: 12px;
      --app-radius-sm: 8px;
      --app-font: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      --app-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    html[data-theme="dark"] {
      color-scheme: dark;
      --app-bg: #171717;
      --app-surface: #262626;
      --app-surface-elevated: #303030;
      --app-text: #f5f5f5;
      --app-text-muted: #a3a3a3;
      --app-border: #383838;
      --app-border-strong: #525252;
      --app-accent: #f5f5f5;
      --app-accent-fg: #171717;
      --app-code-bg: #222222;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 16px;
      font-family: var(--app-font);
      font-size: 14px;
      line-height: 1.5;
      background-color: var(--app-bg);
      color: var(--app-text);
      transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
    }

    /* Pre-built utility classes matching the host application's neutral palette */
    .app-card {
      background-color: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: var(--app-radius);
      padding: 14px 16px;
      color: var(--app-text);
    }

    .app-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 500;
      background-color: var(--app-surface-elevated);
      color: var(--app-text);
      border: 1px solid var(--app-border);
    }

    .app-muted {
      color: var(--app-text-muted);
    }

    .app-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }

    form, .widget-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    label {
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      color: var(--app-text);
    }

    input[type="text"],
    input[type="number"],
    input[type="email"],
    input[type="date"],
    input[type="search"],
    input[type="password"],
    select,
    textarea {
      width: 100%;
      padding: 8px 11px;
      border-radius: var(--app-radius-sm);
      border: 1px solid var(--app-border);
      background-color: var(--app-surface);
      color: var(--app-text);
      font-family: var(--app-font);
      font-size: 13.5px;
      outline: none;
      transition: border-color 0.15s, background-color 0.15s;
    }

    input:focus, select:focus, textarea:focus {
      border-color: var(--app-border-strong);
      background-color: var(--app-bg);
    }

    input[type="checkbox"], input[type="radio"] {
      accent-color: var(--app-accent);
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    input[type="range"] {
      accent-color: var(--app-accent);
      width: 100%;
    }

    button, .btn, .app-btn {
      padding: 8px 14px;
      border-radius: var(--app-radius-sm);
      border: 1px solid transparent;
      background-color: var(--app-accent);
      color: var(--app-accent-fg);
      font-family: var(--app-font);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s, background-color 0.15s;
    }

    button:hover, .btn:hover, .app-btn:hover {
      opacity: 0.88;
    }

    .app-btn-secondary {
      background-color: var(--app-surface);
      color: var(--app-text);
      border: 1px solid var(--app-border);
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      border: 1px solid var(--app-border);
      padding: 8px 10px;
      text-align: left;
    }

    th {
      background-color: var(--app-surface);
    }

    hr {
      border: none;
      border-top: 1px solid var(--app-border);
      margin: 12px 0;
    }

    code, pre {
      font-family: var(--app-font-mono);
      background-color: var(--app-code-bg);
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div id="__widget_root__">
    ${htmlCode}
  </div>
  <script>
    (function() {
      const FRAME_ID = ${JSON.stringify(frameId)};
      const LABELS = ${JSON.stringify(labels)};

      function applyTheme(isDark) {
        const themeName = isDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', themeName);
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(themeName);
        window.dispatchEvent(new CustomEvent('app-theme-change', {
          detail: { theme: themeName, isDark: Boolean(isDark) }
        }));
      }

      function reportHeight() {
        const root = document.getElementById('__widget_root__');
        const h = Math.max(
          root ? root.scrollHeight + 32 : 120,
          document.body.scrollHeight
        );
        window.parent.postMessage({
          type: 'OLLAMA_IFRAME_HEIGHT',
          frameId: FRAME_ID,
          height: h
        }, '*');
      }

      window.addEventListener('load', reportHeight);
      if (window.ResizeObserver) {
        new ResizeObserver(reportHeight).observe(document.body);
      }
      setTimeout(reportHeight, 120);
      setTimeout(reportHeight, 450);

      function collectAllInteractiveValues() {
        const entries = [];
        const processedRadioNames = new Set();
        const processedCheckboxNames = new Set();

        const elements = document.querySelectorAll('input, select, textarea');
        elements.forEach((el, idx) => {
          const tag = el.tagName.toLowerCase();
          const type = (el.getAttribute('type') || '').toLowerCase();
          if (type === 'submit' || type === 'button' || type === 'hidden') return;

          let label = el.getAttribute('data-label') || el.getAttribute('name') || el.getAttribute('placeholder') || el.id || '';
          if (!label) {
            const parentLabel = el.closest('label');
            if (parentLabel) {
              label = parentLabel.innerText.trim();
            } else if (el.id) {
              const forLabel = document.querySelector('label[for="' + el.id + '"]');
              if (forLabel) label = forLabel.innerText.trim();
            }
          }
          if (!label) label = LABELS.fieldFallbackPrefix + ' ' + (idx + 1);

          if (type === 'checkbox') {
            const groupName = el.getAttribute('name');
            if (groupName && document.querySelectorAll('input[type="checkbox"][name="' + groupName + '"]').length > 1) {
              if (processedCheckboxNames.has(groupName)) return;
              processedCheckboxNames.add(groupName);
              const checkedBoxes = Array.from(document.querySelectorAll('input[type="checkbox"][name="' + groupName + '"]:checked'));
              const values = checkedBoxes.map(cb => {
                const pLabel = cb.closest('label');
                return cb.value && cb.value !== 'on' ? cb.value : (pLabel ? pLabel.innerText.trim() : LABELS.yesValue);
              });
              entries.push({ label: groupName, value: values.length ? values.join(', ') : LABELS.nothingSelectedValue });
            } else {
              entries.push({ label: label, value: el.checked ? (el.value && el.value !== 'on' ? el.value : LABELS.yesCheckedValue) : LABELS.noValue });
            }
          } else if (type === 'radio') {
            const groupName = el.getAttribute('name') || ('radio_' + idx);
            if (processedRadioNames.has(groupName)) return;
            processedRadioNames.add(groupName);
            const checked = document.querySelector('input[type="radio"][name="' + groupName + '"]:checked');
            if (checked) {
              const pLabel = checked.closest('label');
              const val = checked.value && checked.value !== 'on' ? checked.value : (pLabel ? pLabel.innerText.trim() : LABELS.selectedValue);
              entries.push({ label: groupName, value: val });
            }
          } else if (tag === 'select') {
            if (el.multiple) {
              const selected = Array.from(el.selectedOptions).map(o => o.text || o.value);
              entries.push({ label: label, value: selected.join(', ') || LABELS.notSelectedValue });
            } else {
              const opt = el.options[el.selectedIndex];
              entries.push({ label: label, value: opt ? (opt.text || opt.value) : el.value });
            }
          } else {
            const val = (el.value || '').trim();
            if (val !== '') {
              entries.push({ label: label, value: val });
            }
          }
        });

        return entries;
      }

      window.submitWidget = function(customPayload) {
        let entries = [];
        if (customPayload && typeof customPayload === 'object') {
          entries = Object.entries(customPayload).map(([k, v]) => ({ label: k, value: String(v) }));
        } else {
          entries = collectAllInteractiveValues();
        }
        window.parent.postMessage({
          type: 'OLLAMA_WIDGET_SUBMIT_DATA',
          frameId: FRAME_ID,
          entries: entries
        }, '*');
      };

      document.addEventListener('submit', function(e) {
        e.preventDefault();
        window.submitWidget();
      });

      document.addEventListener('click', function(e) {
        const a = e.target && e.target.closest ? e.target.closest('a') : null;
        if (a && a.href && /^https?:\\/\\//i.test(a.href)) {
          e.preventDefault();
          window.parent.postMessage({
            type: 'OLLAMA_OPEN_EXTERNAL_URL',
            frameId: FRAME_ID,
            url: a.href
          }, '*');
        }
      });

      window.addEventListener('message', function(e) {
        if (!e.data || e.data.frameId !== FRAME_ID) return;
        if (e.data.type === 'REQUEST_WIDGET_DATA') {
          window.submitWidget();
        } else if (e.data.type === 'APP_THEME_CHANGE') {
          applyTheme(e.data.isDark);
        }
      });
    })();
  </script>
</body>
</html>`;
}
