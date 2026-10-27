import React, { useState } from 'react';
import { Plus, Trash2, RefreshCw, PlugZap, AlertCircle } from 'lucide-react';
import type { McpServerConfig, McpServerStatus } from '../../types/chat';
import { useI18n } from '../../i18n';

interface McpSettingsTabProps {
  mcpServers: McpServerStatus[];
  onSaveMcpServer: (
    server: Omit<McpServerConfig, 'id' | 'createdAt'> & { id?: string }
  ) => Promise<void>;
  onDeleteMcpServer: (id: string) => Promise<void>;
  onReconnectMcpServer: (id: string) => Promise<void>;
}

export const McpSettingsTab: React.FC<McpSettingsTabProps> = ({
  mcpServers,
  onSaveMcpServer,
  onDeleteMcpServer,
  onReconnectMcpServer,
}) => {
  const { t } = useI18n();
  const [mcpName, setMcpName] = useState('');
  const [mcpTransport, setMcpTransport] = useState<'stdio' | 'http'>('stdio');
  const [mcpCommand, setMcpCommand] = useState('npx');
  const [mcpArgsText, setMcpArgsText] = useState('');
  const [mcpEnvText, setMcpEnvText] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');
  const [isSavingMcp, setIsSavingMcp] = useState(false);

  const handleAddMcp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mcpName.trim()) return;
    setIsSavingMcp(true);
    try {
      const parsedArgs = mcpArgsText
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const envObj: Record<string, string> = {};
      mcpEnvText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((line) => {
          const eqIdx = line.indexOf('=');
          if (eqIdx > 0) {
            envObj[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
          }
        });

      await onSaveMcpServer({
        name: mcpName.trim(),
        transport: mcpTransport,
        command: mcpTransport === 'stdio' ? mcpCommand.trim() : undefined,
        args: mcpTransport === 'stdio' ? parsedArgs : undefined,
        env: mcpTransport === 'stdio' ? envObj : undefined,
        url: mcpTransport === 'http' ? mcpUrl.trim() : undefined,
        enabled: true,
      });

      setMcpName('');
      setMcpArgsText('');
      setMcpEnvText('');
      setMcpUrl('');
    } finally {
      setIsSavingMcp(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 text-neutral-600 dark:text-neutral-400 leading-relaxed">
        {t.settings.mcp.intro}
      </div>

      {/* Add MCP Server Form */}
      <form
        onSubmit={handleAddMcp}
        className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/40 space-y-3"
      >
        <div className="font-medium text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
          <PlugZap className="w-3.5 h-3.5" />
          <span>{t.settings.mcp.addTitle}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input
            type="text"
            value={mcpName}
            onChange={(e) => setMcpName(e.target.value)}
            placeholder={t.settings.mcp.namePlaceholder}
            className="sm:col-span-2 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
            required
          />
          <select
            value={mcpTransport}
            onChange={(e) => setMcpTransport(e.target.value as 'stdio' | 'http')}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
          >
            <option value="stdio">{t.settings.mcp.transportStdio}</option>
            <option value="http">{t.settings.mcp.transportHttp}</option>
          </select>
        </div>

        {mcpTransport === 'stdio' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="text"
                value={mcpCommand}
                onChange={(e) => setMcpCommand(e.target.value)}
                placeholder={t.settings.mcp.commandPlaceholder}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono"
                required
              />
              <input
                type="text"
                value={mcpArgsText}
                onChange={(e) => setMcpArgsText(e.target.value)}
                placeholder={t.settings.mcp.argsPlaceholder}
                className="sm:col-span-2 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono"
              />
            </div>
            <textarea
              rows={2}
              value={mcpEnvText}
              onChange={(e) => setMcpEnvText(e.target.value)}
              placeholder={t.settings.mcp.envPlaceholder}
              className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono text-[11px]"
            />
          </div>
        ) : (
          <input
            type="url"
            value={mcpUrl}
            onChange={(e) => setMcpUrl(e.target.value)}
            placeholder={t.settings.mcp.urlPlaceholder}
            className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono"
            required
          />
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSavingMcp}
            className="px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 font-medium inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {isSavingMcp ? t.settings.mcp.connectingBtn : t.settings.mcp.addAndConnectBtn}
            </span>
          </button>
        </div>
      </form>

      {/* MCP Servers List */}
      <div className="space-y-2">
        {mcpServers.length === 0 ? (
          <div className="py-8 text-center text-neutral-400">{t.settings.mcp.empty}</div>
        ) : (
          mcpServers.map((srv) => (
            <div
              key={srv.id}
              className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/50 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      srv.status === 'connected'
                        ? 'bg-neutral-800 dark:bg-neutral-200'
                        : srv.status === 'error'
                        ? 'bg-neutral-500 animate-pulse'
                        : 'bg-neutral-300 dark:bg-neutral-700'
                    }`}
                  />
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {srv.name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-mono text-neutral-500 uppercase">
                    {srv.transport}
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    (
                    {srv.status === 'connected'
                      ? `${t.settings.mcp.connectedStatusPrefix} • ${srv.tools.length} ${t.settings.mcp.toolsShort}`
                      : srv.status}
                    )
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={srv.enabled}
                    onChange={(e) =>
                      onSaveMcpServer({
                        id: srv.id,
                        name: srv.name,
                        transport: srv.transport,
                        command: srv.command,
                        args: srv.args,
                        env: srv.env,
                        url: srv.url,
                        enabled: e.target.checked,
                      })
                    }
                    className="w-3.5 h-3.5 accent-neutral-800 dark:accent-neutral-200 cursor-pointer"
                    title={t.settings.mcp.toggleTooltip}
                  />
                  <button
                    type="button"
                    onClick={() => onReconnectMcpServer(srv.id)}
                    className="p-1 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-neutral-500"
                    title={t.settings.mcp.reconnectTooltip}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteMcpServer(srv.id)}
                    className="p-1 rounded hover:bg-neutral-200/70 dark:hover:bg-neutral-800 text-neutral-500"
                    title={t.settings.mcp.deleteTooltip}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="text-[11px] font-mono text-neutral-500 truncate">
                {srv.transport === 'stdio'
                  ? `${srv.command} ${(srv.args || []).join(' ')}`
                  : srv.url}
              </div>

              {srv.error && (
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900 p-2 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="break-all">{srv.error}</span>
                </div>
              )}

              {srv.tools.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {srv.tools.map((toolItem) => (
                    <span
                      key={toolItem.name}
                      className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 font-mono text-[10px] text-neutral-700 dark:text-neutral-300"
                      title={toolItem.description || toolItem.name}
                    >
                      {toolItem.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
