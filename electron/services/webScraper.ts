/**
 * Decode common HTML entities in scraped snippets/titles.
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));
}

/**
 * Direct HTML-based web search using DuckDuckGo HTML endpoint (no API keys or 3rd-party paid services).
 */
export async function performDirectWebSearch(
  query: string,
  maxResults = 6
): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
    const res = await fetch(searchUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    const results: Array<{ title: string; url: string; snippet: string }> = [];

    // Match result blocks in DuckDuckGo HTML version
    const resultBlockRegex =
      /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>)?/gi;

    let match: RegExpExecArray | null;
    while ((match = resultBlockRegex.exec(html)) !== null && results.length < maxResults) {
      let rawUrl = match[1] || '';
      const rawTitle = match[2] || '';
      const rawSnippet = match[3] || match[4] || '';

      // Unwrap DuckDuckGo redirect URL (`//duckduckgo.com/l/?uddg=...`)
      const uddgMatch = rawUrl.match(/[?&]uddg=([^&]+)/);
      if (uddgMatch && uddgMatch[1]) {
        try {
          rawUrl = decodeURIComponent(uddgMatch[1]);
        } catch {
          // keep raw
        }
      } else if (rawUrl.startsWith('//')) {
        rawUrl = 'https:' + rawUrl;
      }

      const title = decodeHtmlEntities(rawTitle.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
      const snippet = decodeHtmlEntities(
        rawSnippet.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      );

      if (title && rawUrl.startsWith('http') && !rawUrl.includes('duckduckgo.com/y.js')) {
        results.push({ title, url: rawUrl, snippet });
      }
    }

    return results;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Direct Web Page Content Extractor (fetches URL and extracts readable title & text without 3rd-party services).
 */
export async function fetchDirectWebPageContent(
  url: string,
  maxChars = 10000
): Promise<{ url: string; title: string; content: string }> {
  const cleanUrl = url.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    throw new Error('URL должен начинаться с http:// или https://');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);

  try {
    const res = await fetch(cleanUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} при загрузке ${cleanUrl}`);
    }

    const contentType = res.headers.get('content-type') || '';
    const rawBody = await res.text();

    if (contentType.includes('application/json') || contentType.includes('text/plain')) {
      return {
        url: cleanUrl,
        title: cleanUrl,
        content: rawBody.slice(0, maxChars),
      };
    }

    const titleMatch = rawBody.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch
      ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ').trim())
      : cleanUrl;

    // Remove scripts, styles, svg, nav, footer, head, noscript, comments
    let cleaned = rawBody
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|svg|noscript|iframe|header|footer|nav|aside)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, ' ');

    // Preserve paragraph/heading breaks before stripping remaining HTML tags
    cleaned = cleaned
      .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|section|article|blockquote)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');

    cleaned = decodeHtmlEntities(cleaned)
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line.length > 0)
      .join('\n');

    if (cleaned.length > maxChars) {
      cleaned = cleaned.slice(0, maxChars) + '\n...[контент страницы сокращён]...';
    }

    return {
      url: cleanUrl,
      title,
      content: cleaned || '(Не удалось извлечь текстовый контент со страницы)',
    };
  } finally {
    clearTimeout(timeout);
  }
}
