function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const KEYWORDS = new Set([
  // JS / TS
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
  'finally', 'for', 'from', 'function', 'get', 'if', 'implements', 'import',
  'in', 'instanceof', 'interface', 'let', 'module', 'namespace', 'new', 'of',
  'package', 'private', 'protected', 'public', 'readonly', 'return', 'satisfies',
  'set', 'static', 'super', 'switch', 'this', 'throw', 'try', 'type', 'typeof',
  'var', 'void', 'while', 'with', 'yield', 'as', 'declare', 'abstract', 'keyof',
  // Python
  'and', 'assert', 'def', 'del', 'elif', 'except', 'global', 'is', 'lambda',
  'nonlocal', 'not', 'or', 'pass', 'raise', ' match', ' Self',
  // Rust / Go / C / C++ / Java / Swift / Kotlin
  'fn', 'pub', 'mut', 'impl', 'trait', 'struct', 'where', 'use', 'mod', 'crate',
  'move', 'ref', 'unsafe', 'extern', 'loop', 'match', 'func', 'defer', 'go',
  'chan', 'select', 'fallthrough', 'range', 'val', 'fun', 'object', 'companion',
  'override', 'open', 'sealed', 'data', 'guard', 'protocol', 'extension',
  'init', 'deinit', 'subscript', 'throws', 'rethrows', 'include', 'define',
  'ifdef', 'ifndef', 'endif', 'pragma', 'using', 'virtual', 'friend', 'constexpr',
  'nullptr', 'sizeof', 'typedef', 'union', 'volatile', 'register', 'synchronized',
  'transient', 'final', 'native',
  // SQL
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'ADD', 'COLUMN', 'INDEX',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'JOIN', 'INNER', 'LEFT', 'RIGHT',
  'FULL', 'OUTER', 'ON', 'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'LIMIT',
  'OFFSET', 'HAVING', 'DISTINCT', 'AS', 'AND', 'OR', 'NOT', 'NULL', 'IS',
  'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'UNION', 'ALL', 'CASE', 'WHEN', 'THEN',
  'ELSE', 'END', 'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'PRAGMA',
  'IF', 'EXISTS', 'CASCADE', 'DEFAULT', 'UNIQUE',
  // Shell / Bash
  'fi', 'then', 'elif', 'done', 'esac', 'local', 'export', 'source', 'alias',
  'unset', 'readonly', 'shift',
]);

const BUILTINS_AND_TYPES = new Set([
  'string', 'number', 'boolean', 'any', 'unknown', 'never', 'object', 'symbol',
  'bigint', 'Array', 'Promise', 'Record', 'Partial', 'Required', 'Readonly',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Date', 'RegExp', 'Error', 'JSON', 'Math',
  'Object', 'Function', 'String', 'Number', 'Boolean', 'console', 'window',
  'document', 'process', 'Buffer', 'React', 'useState', 'useEffect', 'useRef',
  'useMemo', 'useCallback', 'useContext',
  'int', 'float', 'double', 'char', 'long', 'short', 'byte', 'usize', 'isize',
  'u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128', 'f32',
  'f64', 'str', 'bool', 'list', 'dict', 'tuple', 'set', 'frozenset', 'Option',
  'Result', 'Some', 'Ok', 'Err', 'Vec', 'Box', 'Rc', 'Arc', 'TEXT', 'INTEGER',
  'REAL', 'BLOB', 'NUMERIC', 'VARCHAR', 'BOOLEAN', 'TIMESTAMP',
]);

const LITERALS = new Set([
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
  'True', 'False', 'None', 'nil', 'NULL', 'TRUE', 'FALSE',
]);

// Single-pass master tokenizer regex:
// Group 1: Comments (/* ... */, //..., <!-- ... -->, #..., --...)
// Group 2: JSON property key ("key"\s*:)
// Group 3: Strings ("""...""", '''...''', "...", '...', `...`)
// Group 4: Decorators / Attributes (@ident, #[...])
// Group 5: HTML / JSX / XML tags (</?TagName or />)
// Group 6: Numbers (hex, binary, float, int)
// Group 7: Identifiers & Keywords (with optional lookahead for function call)
const MASTER_TOKEN_REGEX =
  /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|<!--[\s\S]*?-->|#(?![0-9a-fA-F]{3,8}\b)[^\n]*|--[^\n]*)|("(?:\\.|[^"\\])*"(?=\s*:))|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(@[a-zA-Z_]\w*|#\[[^\]]*\])|(<\/?[a-zA-Z][a-zA-Z0-9._:-]*|\/?>)|\b(0x[0-9a-fA-F_]+|0b[01_]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b|\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b(\s*\()?/g;

export function highlightCodeToHtml(code: string, lang = ''): string {
  if (!code) return '';

  const normalizedLang = lang.trim().toLowerCase();

  // Special handling for diff blocks
  if (normalizedLang === 'diff' || normalizedLang === 'patch') {
    return code
      .split('\n')
      .map((line) => {
        const escaped = escapeHtml(line);
        if (line.startsWith('+') && !line.startsWith('+++')) {
          return `<span class="syn-diff-add">${escaped}</span>`;
        }
        if (line.startsWith('-') && !line.startsWith('---')) {
          return `<span class="syn-diff-del">${escaped}</span>`;
        }
        if (line.startsWith('@@')) {
          return `<span class="syn-keyword">${escaped}</span>`;
        }
        return escaped;
      })
      .join('\n');
  }

  let result = '';
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  MASTER_TOKEN_REGEX.lastIndex = 0;

  while ((match = MASTER_TOKEN_REGEX.exec(code)) !== null) {
    if (match.index > lastIdx) {
      result += escapeHtml(code.slice(lastIdx, match.index));
    }

    const [
      fullMatch,
      comment,
      jsonKey,
      strLiteral,
      decorator,
      htmlTag,
      numLiteral,
      identifier,
      fnCallParen,
    ] = match;

    if (comment !== undefined) {
      result += `<span class="syn-comment">${escapeHtml(comment)}</span>`;
    } else if (jsonKey !== undefined) {
      result += `<span class="syn-attr">${escapeHtml(jsonKey)}</span>`;
    } else if (strLiteral !== undefined) {
      result += `<span class="syn-string">${escapeHtml(strLiteral)}</span>`;
    } else if (decorator !== undefined) {
      result += `<span class="syn-decorator">${escapeHtml(decorator)}</span>`;
    } else if (htmlTag !== undefined) {
      result += `<span class="syn-tag">${escapeHtml(htmlTag)}</span>`;
    } else if (numLiteral !== undefined) {
      result += `<span class="syn-number">${escapeHtml(numLiteral)}</span>`;
    } else if (identifier !== undefined) {
      const trailingParen = fnCallParen ? escapeHtml(fnCallParen) : '';
      if (LITERALS.has(identifier)) {
        result += `<span class="syn-literal">${escapeHtml(identifier)}</span>${trailingParen}`;
      } else if (
        KEYWORDS.has(identifier) ||
        (normalizedLang === 'sql' && KEYWORDS.has(identifier.toUpperCase()))
      ) {
        result += `<span class="syn-keyword">${escapeHtml(identifier)}</span>${trailingParen}`;
      } else if (
        BUILTINS_AND_TYPES.has(identifier) ||
        (normalizedLang === 'sql' && BUILTINS_AND_TYPES.has(identifier.toUpperCase()))
      ) {
        result += `<span class="syn-type">${escapeHtml(identifier)}</span>${trailingParen}`;
      } else if (fnCallParen !== undefined) {
        result += `<span class="syn-func">${escapeHtml(identifier)}</span>${trailingParen}`;
      } else if (/^[A-Z][A-Za-z0-9_]*$/.test(identifier)) {
        result += `<span class="syn-type">${escapeHtml(identifier)}</span>`;
      } else {
        result += escapeHtml(fullMatch);
      }
    } else {
      result += escapeHtml(fullMatch);
    }

    lastIdx = MASTER_TOKEN_REGEX.lastIndex;
  }

  if (lastIdx < code.length) {
    result += escapeHtml(code.slice(lastIdx));
  }

  return result;
}
