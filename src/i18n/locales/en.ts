import type { TranslationDictionary } from './ru';

export const en: TranslationDictionary = {
  common: {
    save: 'Save',
    close: 'Close',
    cancel: 'Cancel',
    delete: 'Delete',
    add: 'Add',
    edit: 'Edit',
    retry: 'Retry request',
    copy: 'Copy',
    copied: 'Copied!',
    next: 'Next',
    back: 'Back',
    loading: 'Loading...',
  },
  prompts: {
    baseSystemPrompt: `You are an intelligent, accurate, and concise AI assistant inside the Synapse desktop application (Synapse by zemskov.space).

### 1. MESSAGE DATES & TIMESTAMPS
Every user message and conversation history entry is prefixed with its exact local date and time in the format \`[YYYY-MM-DD HH:MM:SS]\`.
- Pay attention to message timestamps, chronological order, time gaps between turns, and the current system time.
- Do NOT write the \`[YYYY-MM-DD HH:MM:SS]\` prefix at the beginning of your own replies — the application adds timestamps automatically.

### 2. FUNCTION CALLING (TOOLS)
You have access to built-in functions (tools) that you can invoke:
1. \`rename_chat({ title })\` — renames the current chat. Call this automatically whenever the chat still has a default title ("New Chat", "Incognito Chat", "Новый диалог", "Инкогнито чат") or when the conversation topic becomes clear or changes.
2. Long-term global user memory management (available in regular chats; in "Incognito" mode memory is read-only):
   - \`memory_add({ content })\` — save a new important fact about the user.
   - \`memory_update({ id, content })\` — update an existing memory entry by its \`id\` if details changed or were clarified.
   - \`memory_delete({ id })\` — delete an outdated or inaccurate memory entry by its \`id\`.
   In the system context you receive the list of all memory entries along with their \`id\`, creation date (\`created_at\`), and last update date (\`updated_at\`). Use these timestamps to understand how current each fact is.
3. Direct web access (when enabled):
   - \`web_search({ query })\` — run a direct web search and get titles, URLs, and snippets.
   - \`fetch_web_page({ url })\` — fetch and read the text content of a specific web page by URL.

If your model build supports native \`tool_calls\`, use them. When needed, you may also invoke a tool via a fenced block \`\`\`tool_call\n{"name": "tool_name", "arguments": {...}}\n\`\`\` — the system will execute the function and return the result.

### 3. MARKDOWN FORMATTING, HTML BLOCKS (IFRAME) & ADAPTIVE THEME CSS VARIABLES
- Use rich Markdown to structure your text (headings, lists, tables, bold text, code blocks).
- Whenever the user asks for a visualization, chart, card, layout, mini-app, or UI demonstration — output a self-contained \`\`\`html ... \`\`\` block.
- Any code block with language \`html\` (\`\`\`html) is automatically rendered live inside an isolated sandboxed \`iframe\`.
- **IMPORTANT: Adaptive Color Palette (Light / Dark Theme)**
  Every HTML iframe automatically receives CSS custom properties and utility classes from the host application that update immediately when the user switches between Light and Dark themes.
  **Always use these CSS variables instead of hardcoded HEX colors** so your HTML blocks and widgets look great in both Light and Dark themes:
  - \`var(--app-bg)\` — primary page / block background (\`#ffffff\` in light, \`#171717\` in dark).
  - \`var(--app-surface)\` — card, panel, and section background (\`#f5f5f5\` in light, \`#262626\` in dark).
  - \`var(--app-surface-elevated)\` — elevated surface / hover state / input background (\`#ebebeb\` in light, \`#303030\` in dark).
  - \`var(--app-text)\` — primary text and heading color (\`#171717\` in light, \`#f5f5f5\` in dark).
  - \`var(--app-text-muted)\` — secondary muted text and captions (\`#737373\` in light, \`#a3a3a3\` in dark).
  - \`var(--app-border)\` — border and divider color (\`#e5e5e5\` in light, \`#383838\` in dark).
  - \`var(--app-border-strong)\` — stronger border on focus/hover (\`#a3a3a3\` in light, \`#525252\` in dark).
  - \`var(--app-accent)\` — primary high-contrast accent (buttons, active elements: \`#171717\` in light, \`#f5f5f5\` in dark).
  - \`var(--app-accent-fg)\` — foreground text on \`--app-accent\` (\`#ffffff\` in light, \`#171717\` in dark).
  - \`var(--app-code-bg)\` — background for inline code and badges.
  - \`var(--app-radius)\` — standard border radius (\`12px\`), \`var(--app-radius-sm)\` (\`8px\`), \`var(--app-font)\` — system UI font stack.
  - Pre-built utility classes are also available: \`.app-card\` (card with \`--app-surface\` background and \`--app-border\`), \`.app-badge\` (pill badge), \`.app-btn\` (primary button), \`.app-btn-secondary\` (secondary button), \`.app-grid\` (responsive grid), \`.app-muted\` (muted text).
  - Inside iframe JavaScript, the active theme is available at \`document.documentElement.dataset.theme\` (\`"dark"\` or \`"light"\`), and theme switches dispatch \`window.addEventListener('app-theme-change', (e) => { console.log(e.detail.theme, e.detail.isDark); })\`.

### 4. INTERACTIVE QUESTIONNAIRE & FORM WIDGETS AT THE END OF A REPLY (\`\`\`html-widget\`)
When continuing the conversation, clarifying requirements, configuring parameters, or letting the user choose between options is easier with checkboxes, dropdowns (\`select\`), radio buttons, range sliders, or text inputs (\`input\` / \`textarea\`):
- You can append a special interactive block with language \`html-widget\` **at the very end of your reply**:
\`\`\`html-widget
<form>
  <!-- Your form controls: input, select, textarea with meaningful name="..." attributes and labels -->
</form>
\`\`\`
- Rules for \`\`\`html-widget\`\`\` blocks:
  1. Place it **strictly at the end of your reply** after your main text, styled with \`var(--app-*)\` variables or standard form tags (which are pre-styled for the active theme).
  2. Give every interactive control (\`<input>\`, \`<select>\`, \`<textarea>\`) a clear, human-readable \`name\` or \`data-label\` attribute (e.g., \`name="Programming Language"\`, \`name="Framework"\`) so the submitted summary is easy to read.
  3. Below the widget, the chat UI automatically renders a **"Submit response to chat"** button that collects all selected checkboxes, dropdowns, and inputs and sends them as the user's next message in the conversation.`,
    contextCompressionPrompt: `You are a conversation context compression module.
Your task is to read the previous context summary (if any) and the list of older conversation messages (with their timestamps), and produce a compact yet comprehensive summary in the language of the conversation.

Be sure to preserve:
1. Key facts about the user, their preferences, and goals.
2. Decisions made, important code snippets, file names, and architectural agreements.
3. Chronological anchors (when and what was discussed, if dates matter).
4. Current status of the ongoing task.

Write densely, without filler, using clearly structured bullet points. Output ONLY the compressed summary text.`,
    currentSystemTimeLabel: 'Current local system time:',
    memoriesEmpty: 'GLOBAL USER MEMORY: currently empty (no records).',
    memoriesHeader:
      'GLOBAL USER MEMORY (known facts with IDs and creation/update timestamps):',
    memoryCreatedLabel: 'created',
    memoryUpdatedLabel: 'updated',
    incognitoPolicyActivePrefix: 'INCOGNITO MODE ACTIVE: Current chat title is',
    incognitoPolicyActiveSuffix:
      'You may call `rename_chat` to rename this incognito chat as well as web search / MCP tools, but global user memory write/update/delete tools are disabled (memory is read-only).',
    incognitoPolicyNormalPrefix: 'Current chat title:',
    incognitoPolicyNormalSuffix:
      'If the chat still has a default title ("New Chat", "Новый диалог") or the topic has become clear, call `rename_chat`. To save, update, or remove facts about the user, call `memory_add`, `memory_update`, and `memory_delete`.',
    mcpServersHeader: 'CONNECTED MCP SERVERS AND THEIR TOOLS:',
    mcpServerLabel: 'Server',
    mcpNoTools: 'no tools',
    availableSkillsHeader: 'AVAILABLE SKILLS:',
    activeSkillsHeader:
      'ACTIVE SKILLS FOR CURRENT USER REQUEST (FOLLOW THEIR INSTRUCTIONS):',
    skillLabel: 'SKILL',
    customInstructionsHeader: 'ADDITIONAL USER INSTRUCTIONS:',
    compressedSummaryHeader: 'COMPRESSED SUMMARY OF PREVIOUS CONVERSATION CONTEXT:',
    continuationEmptyAfterTool:
      'Please provide a complete and detailed answer to the user message.',
    continuationCutOffAfterTool:
      'You interrupted your response mid-sentence to call a function. Please continue and complete your response strictly from where you left off (without repeating the beginning).',
    toolResultFallbackPrefix: 'Function execution result',
    toolResultFallbackSuffix:
      'Continue and complete your response to the user (without repeating text already written).',
    compressionPreviousSummaryHeader: 'PREVIOUS CONTEXT SUMMARY:',
    compressionNewMessagesHeader: 'NEW MESSAGES TO INCLUDE IN SUMMARY:',
    compressionUserRole: 'User',
    compressionAssistantRole: 'Assistant',
    compressionNoticePrefix: 'Compressing older context',
    compressionNoticeMessagesUnit: 'msgs',
    compressionNoticeTokensUnit: 'tokens',
  },
  toolDefinitions: {
    renameChatDesc:
      'Rename the current chat. Call this function when the chat has a default title ("New Chat", "Incognito Chat", "Новый диалог", "Инкогнито чат") or when the conversation topic becomes clear or changes.',
    renameChatParamTitle: 'Concise and descriptive chat title (2–6 words, no quotes).',
    renameChatEmptyError: 'Parameter "title" is empty',
    renameChatSuccessPrefix: 'Chat title successfully changed to',
    renameChatSuccessSuffix:
      'Now make sure to provide or continue your full, complete answer to the user request.',
    memoryAddDesc:
      'Add a new long-term fact about the user to global memory (name, tech stack, projects, preferences, key details). Make sure this fact is not already present in the memory list before adding.',
    memoryAddParamContent: 'Clear and concise fact about the user.',
    memoryAddIncognitoError:
      'Writing to global memory is disabled in Incognito mode (read-only access).',
    memoryAddEmptyError: 'Memory text is empty',
    memoryAddSuccess:
      'Fact saved to global user memory. Continue and complete your response to the user.',
    memoryUpdateDesc:
      'Update an existing entry in global user memory by its ID if information has changed or been clarified.',
    memoryUpdateParamId: 'Exact identifier (id) of the memory record from the global memory list.',
    memoryUpdateParamContent: 'New updated content for the memory record.',
    memoryUpdateIncognitoError:
      'Updating global memory is disabled in Incognito mode (read-only access).',
    memoryUpdateParamsError: 'Both "id" and "content" parameters are required',
    memoryNotFoundErrorPrefix: 'Memory record not found:',
    memoryUpdateSuccessPrefix: 'Memory record successfully updated:',
    memoryDeleteDesc:
      'Delete an outdated or inaccurate entry from global user memory by its ID.',
    memoryDeleteParamId:
      'Exact identifier (id) of the memory record from the global memory list to delete.',
    memoryDeleteIncognitoError:
      'Deleting from global memory is disabled in Incognito mode (read-only access).',
    memoryDeleteParamsError: 'Parameter "id" is required',
    memoryDeleteSuccessPrefix: 'Memory record deleted:',
    webSearchDesc:
      'Perform a direct web search for up-to-date information via a search engine. Returns a list of titles, URLs, and snippets.',
    webSearchParamQuery: 'Search query.',
    webSearchEmptyError: 'Search query is empty',
    fetchWebPageDesc:
      'Fetch and extract the full readable text content of a web page directly by its URL.',
    fetchWebPageParamUrl: 'Full page URL (http:// or https://).',
    fetchWebPageEmptyError: 'URL is not specified',
    unknownToolErrorPrefix: 'Unknown function:',
    executionErrorDefault: 'Tool execution error',
  },
  builtinSkills: {
    review: {
      name: 'Code & Architecture Review',
      description:
        'Deep code audit: bug hunting, performance bottlenecks, security issues, and clean refactoring.',
      instructions: `SKILL ACTIVATED /review (Code & Architecture Review):
1. Analyze the provided code or architectural design critically and systematically.
2. Structure your response into sections: "Critical Issues & Bugs", "Security & Edge Cases", "Performance & Readability", and "Proposed Refactoring".
3. Provide the improved code with clear explanations.`,
    },
    ui: {
      name: 'Interactive HTML Prototype',
      description:
        'Generate a live interactive UI prototype or dashboard inside an ```html block with adaptive theme variables.',
      instructions: `SKILL ACTIVATED /ui (Interactive HTML Prototype):
1. Create a complete, interactive, and visually polished interface inside an \`\`\`html code block.
2. Always use the application's CSS custom properties (\`var(--app-bg)\`, \`var(--app-surface)\`, \`var(--app-surface-elevated)\`, \`var(--app-text)\`, \`var(--app-text-muted)\`, \`var(--app-border)\`, \`var(--app-accent)\`, \`var(--app-accent-fg)\`) and utility classes (\`.app-card\`, \`.app-btn\`, \`.app-badge\`) so the UI adapts seamlessly to both Light and Dark themes.
3. Include live JavaScript interactivity (tab switching, filtering, charts, or calculations).`,
    },
    research: {
      name: 'Web Research with Sources',
      description:
        'In-depth web search via web_search and page reading via fetch_web_page with a structured comparison table.',
      instructions: `SKILL ACTIVATED /research (Web Research):
1. Use the \`web_search\` tool to find up-to-date information on the topic, and then call \`fetch_web_page\` to read the most relevant pages.
2. Compile a structured analytical report with facts, figures, and a comparison table.
3. Cite verified source links at the end.`,
    },
    brief: {
      name: 'Interactive Discovery Brief',
      description:
        'Asks clarifying questions about your task using an interactive ```html-widget form with checkboxes and inputs.',
      instructions: `SKILL ACTIVATED /brief (Interactive Discovery Brief):
1. Briefly analyze the user's idea and identify what key details are missing for an ideal solution.
2. At the very end of your response, include an \`\`\`html-widget block containing a well-structured form (checkboxes, radio buttons, select dropdowns, text inputs with descriptive \`name\` attributes) so the user can select their preferences and submit them back to the chat in one click.`,
    },
  },
  sidebar: {
    serverOnline: 'Local server online',
    serverOffline: 'Server offline',
    settingsTooltip: 'Settings, Providers, Memory, MCP & Skills',
    newChat: 'New Chat',
    incognito: 'Incognito',
    incognitoTooltip:
      'Incognito chat lives only in RAM, reads memory, and saves nothing to disk',
    searchPlaceholder: 'Search chats and messages...',
    noSearchMatches: 'No chats found matching your query',
    noActiveChats: 'No active conversations. Create a new chat or incognito session.',
    modelNotSelected: 'not selected',
    duplicateChatTooltip: 'Duplicate chat (continue in a branch)',
    deleteChatTooltip: 'Delete chat',
    memoryBtn: 'Memory',
    mcpBtn: 'MCP',
    skillsBtn: 'Skills',
  },
  header: {
    incognitoBadge: 'Incognito (RAM • Read-only Memory)',
    incognitoTooltip:
      'In incognito mode the chat can read global memory but cannot write new facts to it',
    selectOrCreateChat: 'Select or create a chat',
    fromChat: 'From chat:',
    parentChatDefault: 'Original chat',
    parentChatTooltip: 'Jump to the parent chat this copy was branched from',
    duplicateChat: 'Duplicate chat',
    duplicateChatTooltip: 'Duplicate current chat to continue working in a copy',
    compressedSummaryTitle:
      'Older conversation context was compressed into a summary to save model context window',
    hideSummary: 'Hide summary',
    showSummary: 'Show compressed summary',
    memoryUpdatedToast: 'User memory updated',
  },
  emptyState: {
    incognitoTitle: 'Incognito Mode (RAM only)',
    normalTitle: 'Synapse by zemskov.space',
    description:
      'The model automatically names chats, remembers key facts about you across conversations (read-only in incognito), renders HTML in sandboxed iframes, and builds interactive form widgets.',
    card1Title: 'HTML Iframe + Form Widget',
    card1Desc: 'Test live HTML rendering in an iframe and an interactive form at the end',
    card1Prompt:
      'Create a minimalist interactive calculator or timer in HTML/CSS/JS inside an ```html block and include an ```html-widget settings form at the end of your reply.',
    card2Title: 'Interactive Project Brief',
    card2Desc: 'The model will send a form with checkboxes and selects to clarify requirements',
    card2Prompt:
      'Help me design a project architecture. Ask me clarifying questions using an interactive ```html-widget form with checkboxes, a dropdown, and a text input at the end of your response.',
  },
  messages: {
    you: 'You',
    assistant: 'Assistant',
    tokensPerSec: 'tok/s',
    editAndRewind: 'Edit & rewind',
    editAndRewindTooltip: 'Edit this message and regenerate the conversation from this point',
    compressedBadge: 'compressed',
    compressedTooltip: 'This message is already included in the compressed context summary',
    editingNotice: 'Editing message (all subsequent messages after it will be removed)',
    resendFromHere: 'Resend from here',
    retryRequest: 'Retry request',
    retryRequestTooltip: 'Send this request again',
    loadingModelIntoRam: 'Loading model into RAM and preparing response...',
    waitingForModelResponse: 'Model is analyzing the prompt and preparing response...',
    connectingToProvider: 'Contacting external AI service and awaiting response...',
  },
  iframe: {
    interactiveWidgetTitle: 'Interactive Response Widget',
    htmlPreviewTitle: 'HTML Iframe Preview',
    toggleViewTooltip: 'Toggle Preview / HTML Code',
    codeBtn: 'Code',
    iframeBtn: 'Preview',
    collapseHeightTooltip: 'Collapse height',
    expandHeightTooltip: 'Expand height',
    submittedHint: 'Response sent to chat (you can adjust and submit again)',
    fillFormHint: 'Fill out the options above and click the button to send to chat',
    resubmitBtn: 'Send again',
    submitToChatBtn: 'Submit response to chat',
    defaultFormSubmitted: 'Form submitted (default values).',
    formResponseHeader: '📋 **Interactive form response:**',
    fieldFallbackPrefix: 'Field',
    yesValue: 'Yes',
    yesCheckedValue: 'Yes (checked)',
    noValue: 'No',
    nothingSelectedValue: 'None selected',
    selectedValue: 'Selected',
    notSelectedValue: 'Not selected',
  },
  thinking: {
    modelThinking: 'Model is thinking...',
    thinkingStats: 'Model reasoning',
    tokensShort: 'tok.',
    hideThoughts: 'Hide thoughts',
    showThoughts: 'Show reasoning',
    buildingReasoning: 'Building chain of thought...',
  },
  tools: {
    running: 'Running...',
    callArgs: 'Call arguments:',
    callResult: 'Execution result:',
    renameChat: 'Rename chat (rename_chat)',
    memoryAdd: 'Add to memory (memory_add)',
    memoryUpdate: 'Update memory (memory_update)',
    memoryDelete: 'Delete from memory (memory_delete)',
    webSearch: 'Web search (web_search)',
    fetchWebPage: 'Read web page (fetch_web_page)',
    mcpTool: 'MCP tool',
    functionCall: 'Function call',
  },
  composer: {
    placeholder:
      'Write a message or type / to trigger a skill (/review, /ui, /research, /brief)...',
    slashPickerHeader: 'Trigger skill (↑↓ select, Enter apply)',
    attachImageTooltip: 'Attach image',
    skillsTooltip: 'Select a skill (or type / in the input box)',
    mcpSetupTooltip: 'Configure MCP servers',
    modelSelectorTooltip: 'Select model for this chat (Ollama or external API)',
    noModels: 'No models',
    localModelsGroup: 'Local Models (Ollama)',
    refreshModelsTooltip: 'Refresh models list',
    notInRam: 'Not in RAM',
    loadModelTooltip: 'Load model into memory',
    unloadModelTooltip: 'Unload model from memory',
    loadedInRamTooltip: 'Loaded in memory:',
    unloadedFromRamTooltip: 'Model is unloaded from memory',
    cloudProviderBadge: 'Cloud API',
    tpsShort: 't/s',
    stop: 'Stop',
    send: 'Send',
  },
  settings: {
    modalTitle: 'Settings, AI Providers, Memory, MCP & Skills',
    saveSettings: 'Save settings',
    tabs: {
      general: 'General',
      providers: 'AI Providers',
      memory: 'Memory',
      mcp: 'MCP Servers',
      skills: 'Skills',
      prompt: 'Prompt',
      about: 'About',
    },
    general: {
      languageLabel: 'Interface Language (Язык)',
      themeLabel: 'Appearance Theme',
      themeSystem: 'System',
      themeLight: 'Light',
      themeDark: 'Dark',
      ollamaHostLabel: 'Ollama Server URL',
      ollamaApiKeyLabel: 'Ollama API Key (optional)',
      ollamaApiKeyPlaceholder: 'Bearer token if your Ollama server requires authentication',
      defaultModelLabel: 'Default Model for New Chats',
      defaultModelAuto: 'Automatic (first available model)',
      notificationsTitle: 'Desktop Notifications on Response Completion',
      notificationsDesc:
        'Send a native macOS / Windows / Linux notification when the LLM finishes generating a reply',
      soundsTitle: 'Interface sounds',
      soundsDesc: 'Play subtle procedural sounds for buttons and controls',
      compressionTitle: 'Automatic Old Context Compression',
      compressionThreshold: 'Context window fill threshold for compression:',
      keepRecentMessages: 'Number of recent messages to keep uncompressed:',
      webToolsTitle: 'Direct Web Search & Page Reader (Tools)',
      webToolsDesc:
        'Allow the model to call built-in web_search and fetch_web_page tools directly without 3rd-party APIs',
    },
    providers: {
      intro:
        'Connect external AI services via OpenAI-compatible APIs (OpenAI, OpenRouter, DeepSeek, Groq, Together, LM Studio, vLLM, etc.). Added models appear directly in the chat model selector.',
      addTitle: 'Add OpenAI-Compatible Provider',
      editTitle: 'Edit Provider',
      presetsLabel: 'Quick preset:',
      namePlaceholder: 'Name (e.g. OpenRouter or DeepSeek)',
      baseUrlPlaceholder: 'Base URL (e.g. https://api.openai.com/v1)',
      apiKeyPlaceholder: 'API Key (sk-...)',
      modelsPlaceholder:
        'Models comma-separated (e.g. gpt-4o, deepseek-reasoner, anthropic/claude-3.5-sonnet)',
      fetchModelsBtn: 'Fetch models from API (/models)',
      fetchingModels: 'Fetching...',
      saveBtn: 'Save provider',
      addBtn: 'Add provider',
      empty: 'No external AI providers connected yet.',
      modelsCount: 'models:',
    },
    memory: {
      intro:
        'The model manages this memory via memory_add, memory_update, and memory_delete tool calls, and sees creation and update timestamps. In incognito mode memory is read-only.',
      placeholder: 'Add a new fact about yourself manually...',
      empty: 'Memory is empty.',
      created: 'Created:',
      updated: 'Updated:',
      clearAll: 'Clear all user memories',
    },
    mcp: {
      intro:
        'Connect external Model Context Protocol (MCP) servers (via stdio or http). All tools discovered on a server (tools/list) are automatically exposed to the LLM and can be called during conversations.',
      addTitle: 'Add MCP Server',
      namePlaceholder: 'Name (e.g. Filesystem)',
      transportStdio: 'STDIO (Local Process)',
      transportHttp: 'HTTP (JSON-RPC Endpoint)',
      commandPlaceholder: 'Command (npx, uvx, node)',
      argsPlaceholder:
        'Space-separated arguments (e.g. -y @modelcontextprotocol/server-filesystem /tmp)',
      envPlaceholder: 'Environment variables KEY=VALUE (optional, one per line)',
      urlPlaceholder: 'http://127.0.0.1:8080/mcp',
      connectingBtn: 'Connecting...',
      addAndConnectBtn: 'Add & Connect',
      empty: 'No MCP servers added yet.',
      connectedStatusPrefix: 'Connected',
      toolsShort: 'tools',
      toggleTooltip: 'Enable / disable server',
      reconnectTooltip: 'Reconnect and refresh tools list',
      deleteTooltip: 'Delete MCP server',
    },
    skills: {
      intro:
        'Skills are reusable prompt workflows and specialized instructions that you can trigger in the chat input via a slash command (e.g. /review or /ui) or attach using the Skills button in the composer.',
      editTitle: 'Edit Skill',
      createTitle: 'Create New Skill',
      cancelEdit: 'Cancel editing',
      slugPlaceholder: 'command (e.g. sql)',
      namePlaceholder: 'Skill name (e.g. SQL Optimizer)',
      descPlaceholder: 'Short description (shown in the / autocomplete menu)',
      instructionsPlaceholder: 'Detailed system instructions for the model when this skill is active...',
      saveChangesBtn: 'Save changes',
      addSkillBtn: 'Add skill',
      builtinBadge: 'built-in',
      toggleTooltip: 'Enable / disable skill',
      editTooltip: 'Edit skill',
      deleteTooltip: 'Delete skill',
    },
    prompt: {
      customLabel: 'Your Custom System Prompt Instructions',
      customPlaceholder: 'E.g.: Keep answers concise, use TypeScript for code examples...',
      baseLabel: 'Built-in Base System Prompt',
    },
    about: {
      subtitle:
        'Synapse by zemskov.space — local workspace for Ollama language models and OpenAI-compatible APIs',
      versionLabel: 'App Version',
      tapsRemaining: 'Taps left to unlock DB Editor:',
      cardSqliteTitle: 'Local SQLite Storage',
      cardSqliteDesc:
        'All conversations, global user memory, compressed context summaries, and settings are stored locally on your device.',
      cardIncognitoTitle: 'RAM Incognito Mode',
      cardIncognitoDesc:
        'Incognito sessions live exclusively in RAM, have read-only access to memory, and are wiped on close.',
      cardMcpTitle: 'MCP, OpenAI API & Web Tools',
      cardMcpDesc:
        'Connect Model Context Protocol servers, external OpenAI-compatible cloud providers, and autonomous web search.',
      cardSkillsTitle: 'Skills (/) & Interactive HTML Widgets',
      cardSkillsDesc:
        'Trigger workflows via slash commands and render sandboxed HTML iframes and interactive forms that reply back to chat.',
      footerPrivacy: 'Local operation with your Ollama server with zero telemetry.',
    },
  },
  dev: {
    modalTitle: 'Database Editor & RAM Inspector',
    modalSubtitle:
      'Direct SQLite table browser and editor, raw SQL query console, and runtime diagnostics',
    dbFileBtn: 'DB File',
    dbFileBtnTooltip: 'Reveal synapse_local.sqlite in Finder / Explorer',
    devToolsBtn: 'DevTools',
    devToolsBtnTooltip: 'Toggle Chrome DevTools inspector',
    tabs: {
      tables: 'DB Tables (Browse & Edit)',
      sql: 'SQL Console',
      diagnostics: 'RAM (Incognito) & Diagnostics',
    },
    tablesTab: {
      tablesHeader: 'Tables',
      refreshTooltip: 'Refresh tables list',
      recordsCount: 'rows',
      ddlBtn: 'DDL Schema',
      ddlTooltip: 'Show table SQL schema (DDL)',
      searchPlaceholder: 'Filter across all columns...',
      addRowBtn: 'Add Row',
      noData: 'No data to display',
      actionsCol: 'Actions',
      emptyTable: 'Table is empty or no rows match the filter',
      editRowTooltip: 'Edit row',
      deleteRowTooltip: 'Delete row',
      editDrawerTitle: 'Edit row',
      createDrawerTitle: 'New row in',
      saveToDbBtn: 'Save to DB',
      showingRows: 'Showing',
      ofRows: 'of',
      rowUpdatedBanner: 'Row successfully updated in SQLite',
      rowInsertedBanner: 'New row inserted into SQLite',
      rowDeletedBanner: 'Row deleted',
      readError: 'Database read error',
      updateError: 'Failed to update row',
      insertError: 'Failed to insert row',
      deleteError: 'Delete error',
    },
    sqlTab: {
      presetsLabel: 'SQL Presets:',
      presetAllChats: 'All chats',
      presetRecentMessages: 'Last 25 messages',
      presetMemories: 'Global memories',
      presetSettings: 'Settings (JSON)',
      presetChatStats: 'Message stats per chat',
      presetSchema: 'SQLite schema',
      editorHeader: 'SQLite Query (Cmd/Ctrl + Enter to execute)',
      runSqlBtn: 'Execute SQL',
      queryExecuted: 'Query executed',
      rowsModified: 'Rows affected / modified:',
      rowsReturned: 'Rows returned:',
      sqlErrorPrefix: 'SQL Error:',
      msUnit: 'ms',
      emptyPrompt: 'Enter a SQL query above and click "Execute SQL"',
      emptyResultSet: 'Query executed successfully (empty result set, rows modified:',
    },
    diagnosticsTab: {
      loading: 'Loading diagnostics...',
      vacuumSuccessPrefix: 'VACUUM completed. Current DB size:',
      cachesClearedToast: 'Model context caches and tool fallback flags cleared',
      incognitoClearedToast: 'RAM incognito chat store completely cleared',
      sqliteCardTitle: 'Local SQLite Database File (sql.js)',
      refreshTooltip: 'Refresh diagnostics',
      sizeOnDisk: 'Size on disk',
      tablesInSchema: 'Tables in schema',
      storageEngine: 'Storage engine',
      showInFinderBtn: 'Reveal DB File in Finder / Explorer',
      vacuumBtn: 'Run VACUUM (Defragment & compact DB)',
      incognitoCardTitle: 'Incognito Sessions in RAM',
      chatsLabel: 'Chats:',
      messagesLabel: 'Messages:',
      clearIncognitoBtn: 'Clear RAM Chats',
      noIncognitoChats: 'No active incognito chats in RAM right now.',
      messagesShort: 'msgs',
      ollamaCacheTitle: 'Ollama Model Context Cache',
      resetCachesBtn: 'Reset caches',
      cacheEmpty: 'Cache is empty',
      tokensUnit: 'tokens',
      fallbackModelsLabel: 'Models using inline tool fallback (native tools disabled):',
      runtimeTitle: 'Runtime Environment',
      openDevToolsBtn: 'Open Chrome DevTools',
      platformLabel: 'Platform:',
    },
  },
  onboarding: {
    welcomeBadge: 'First Run • Workspace Setup',
    title: 'Welcome to Synapse',
    subtitle: 'Synapse by zemskov.space — your calm local & hybrid AI workspace',
    step1Title: 'Language & Appearance',
    step1Desc: 'Choose your preferred language and interface style',
    step2Title: 'Connect to Ollama Server',
    step2Desc:
      'Enter your local or remote Ollama URL. Ollama must be running and reachable to continue.',
    step3Title: 'Default Model & Notifications',
    step3Desc: 'Pick your primary model for new chats and configure notifications',
    ollamaUrlLabel: 'Ollama Server URL',
    ollamaApiKeyLabel: 'Ollama API Key (optional)',
    ollamaApiKeyHint: 'Fill only if your Ollama instance is behind an authenticated proxy',
    checkConnectionBtn: 'Verify Ollama Connection',
    checkingConnection: 'Checking connection...',
    statusConnected: 'Ollama is online and ready!',
    modelsFound: 'Models found:',
    statusOfflineTitle: 'Ollama server is currently unreachable',
    statusOfflineDesc:
      'Make sure Ollama is installed and running on your computer (or verify the server URL). You cannot proceed until Ollama is reachable.',
    downloadOllamaBtn: 'Download Ollama from Official Website (ollama.com)',
    noModelsWarning:
      'Ollama is running, but no models are installed yet. Run e.g. `ollama pull llama3.2` in your terminal.',
    selectDefaultModelLabel: 'Select default model for new chats',
    enableNotificationsLabel: 'Notify when response generation completes',
    enableNotificationsDesc:
      'Synapse will send a system notification when the model finishes replying',
    finishBtn: 'Get Started with Synapse',
  },
};
