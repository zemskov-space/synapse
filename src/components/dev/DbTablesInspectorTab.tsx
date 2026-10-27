import React, { useEffect, useState } from 'react';
import {
  Database,
  Search,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Key,
  Code2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import type { DbColumnSchema, DbTableInfo, DbTableRowsResponse } from '../../types/chat';
import { useI18n } from '../../i18n';

interface DbTablesInspectorTabProps {
  onDatabaseMutated: () => void;
}

export const DbTablesInspectorTab: React.FC<DbTablesInspectorTabProps> = ({
  onDatabaseMutated,
}) => {
  const { t } = useI18n();
  const [tables, setTables] = useState<DbTableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('chats');
  const [tableData, setTableData] = useState<DbTableRowsResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageOffset, setPageOffset] = useState(0);
  const pageSize = 100;

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [showDdl, setShowDdl] = useState(false);

  // Row editor / creator state
  const [editorMode, setEditorMode] = useState<'edit' | 'create' | null>(null);
  const [editingPkColumn, setEditingPkColumn] = useState<string>('id');
  const [editingPkValue, setEditingPkValue] = useState<string | number>('');
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const loadTablesAndRows = async (
    targetTable = selectedTable,
    search = searchQuery,
    offset = pageOffset
  ) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const allTables = await window.electronAPI.devListTables();
      setTables(allTables);

      const effectiveTable =
        allTables.some((tbl) => tbl.name === targetTable)
          ? targetTable
          : allTables[0]?.name || '';

      if (effectiveTable) {
        if (effectiveTable !== selectedTable) {
          setSelectedTable(effectiveTable);
        }
        const rowsRes = await window.electronAPI.devGetTableRows({
          tableName: effectiveTable,
          limit: pageSize,
          offset,
          search,
        });
        setTableData(rowsRes);
      } else {
        setTableData(null);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t.dev.tablesTab.readError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTablesAndRows(selectedTable, searchQuery, pageOffset);
  }, []);

  const handleSelectTable = async (tableName: string) => {
    setSelectedTable(tableName);
    setSearchQuery('');
    setPageOffset(0);
    setEditorMode(null);
    await loadTablesAndRows(tableName, '', 0);
  };

  const handleSearchChange = async (val: string) => {
    setSearchQuery(val);
    setPageOffset(0);
    await loadTablesAndRows(selectedTable, val, 0);
  };

  const handlePageChange = async (newOffset: number) => {
    setPageOffset(newOffset);
    await loadTablesAndRows(selectedTable, searchQuery, newOffset);
  };

  const getRowPrimaryKey = (row: Record<string, unknown>, pkCol: string | null) => {
    if (pkCol && row[pkCol] !== undefined && row[pkCol] !== null) {
      return { col: pkCol, val: row[pkCol] as string | number };
    }
    return { col: '__rowid__', val: row.__rowid__ as number };
  };

  const openEditRow = (row: Record<string, unknown>) => {
    if (!tableData) return;
    const pk = getRowPrimaryKey(row, tableData.primaryKey);
    setEditingPkColumn(pk.col);
    setEditingPkValue(pk.val);

    const initial: Record<string, string> = {};
    for (const col of tableData.columns) {
      const rawVal = row[col.name];
      if (rawVal === null || rawVal === undefined) {
        initial[col.name] = '';
      } else {
        const strVal = String(rawVal);
        // Pretty-print JSON fields for easier editing
        if (col.name.endsWith('_json') || (col.name === 'value' && strVal.startsWith('{'))) {
          try {
            initial[col.name] = JSON.stringify(JSON.parse(strVal), null, 2);
          } catch {
            initial[col.name] = strVal;
          }
        } else {
          initial[col.name] = strVal;
        }
      }
    }
    setFormValues(initial);
    setEditorMode('edit');
    setErrorMsg(null);
  };

  const openCreateRow = () => {
    if (!tableData) return;
    const initial: Record<string, string> = {};
    const nowIso = new Date().toISOString();

    for (const col of tableData.columns) {
      if (col.pk && col.type.toUpperCase().includes('TEXT')) {
        initial[col.name] = crypto.randomUUID();
      } else if (col.name === 'created_at' || col.name === 'updated_at' || col.name === 'timestamp') {
        initial[col.name] = nowIso;
      } else if (col.dfltValue !== null && col.dfltValue !== undefined) {
        initial[col.name] = String(col.dfltValue).replace(/^'|'$/g, '');
      } else {
        initial[col.name] = '';
      }
    }
    setFormValues(initial);
    setEditorMode('create');
    setErrorMsg(null);
  };

  const coerceColumnValue = (col: DbColumnSchema, rawStr: string): unknown => {
    if (rawStr === '' && !col.notnull) {
      return col.dfltValue !== null ? rawStr : null;
    }
    const upperType = col.type.toUpperCase();
    if (upperType.includes('INT')) {
      const parsed = parseInt(rawStr, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (upperType.includes('REAL') || upperType.includes('FLOA') || upperType.includes('DOUB')) {
      const parsed = parseFloat(rawStr);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    // Minify JSON back if it's a valid JSON object/array in a _json column
    if (col.name.endsWith('_json') && rawStr.trim()) {
      try {
        return JSON.stringify(JSON.parse(rawStr));
      } catch {
        return rawStr;
      }
    }
    return rawStr;
  };

  const handleSaveRowForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableData || !editorMode) return;
    setErrorMsg(null);

    const payloadValues: Record<string, unknown> = {};
    for (const col of tableData.columns) {
      const strVal = formValues[col.name] ?? '';
      payloadValues[col.name] = coerceColumnValue(col, strVal);
    }

    if (editorMode === 'edit') {
      const res = await window.electronAPI.devUpdateRow({
        tableName: tableData.tableName,
        pkColumn: editingPkColumn,
        pkValue: editingPkValue,
        updates: payloadValues,
      });
      if (!res.ok) {
        setErrorMsg(res.error || t.dev.tablesTab.updateError);
        return;
      }
      setStatusBanner(t.dev.tablesTab.rowUpdatedBanner);
    } else {
      const res = await window.electronAPI.devInsertRow({
        tableName: tableData.tableName,
        values: payloadValues,
      });
      if (!res.ok) {
        setErrorMsg(res.error || t.dev.tablesTab.insertError);
        return;
      }
      setStatusBanner(t.dev.tablesTab.rowInsertedBanner);
    }

    setEditorMode(null);
    await loadTablesAndRows(selectedTable, searchQuery, pageOffset);
    onDatabaseMutated();
    setTimeout(() => setStatusBanner(null), 3500);
  };

  const handleDeleteRow = async (row: Record<string, unknown>) => {
    if (!tableData) return;
    const pk = getRowPrimaryKey(row, tableData.primaryKey);
    const res = await window.electronAPI.devDeleteRow({
      tableName: tableData.tableName,
      pkColumn: pk.col,
      pkValue: pk.val,
    });
    if (!res.ok) {
      setErrorMsg(res.error || t.dev.tablesTab.deleteError);
      return;
    }
    if (editorMode === 'edit' && editingPkValue === pk.val) {
      setEditorMode(null);
    }
    setStatusBanner(t.dev.tablesTab.rowDeletedBanner);
    await loadTablesAndRows(selectedTable, searchQuery, pageOffset);
    onDatabaseMutated();
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const currentTableMeta = tables.find((tbl) => tbl.name === selectedTable);

  return (
    <div className="flex h-full min-h-0 divide-x divide-neutral-200 dark:divide-neutral-800">
      {/* Left Sidebar: Tables List */}
      <div className="w-52 flex-shrink-0 flex flex-col bg-neutral-50/70 dark:bg-neutral-950/40">
        <div className="px-3.5 py-2.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          <span>
            {t.dev.tablesTab.tablesHeader} ({tables.length})
          </span>
          <button
            type="button"
            onClick={() => loadTablesAndRows(selectedTable, searchQuery, pageOffset)}
            className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500"
            title={t.dev.tablesTab.refreshTooltip}
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {tables.map((tbl) => {
            const active = tbl.name === selectedTable;
            return (
              <button
                key={tbl.name}
                type="button"
                onClick={() => handleSelectTable(tbl.name)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  active
                    ? 'bg-neutral-900 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800/60'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Database className="w-3.5 h-3.5 flex-shrink-0 opacity-75" />
                  <span className="font-mono truncate">{tbl.name}</span>
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    active
                      ? 'bg-neutral-700 text-neutral-100 dark:bg-neutral-300 dark:text-neutral-900'
                      : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {tbl.rowCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Center: Table Toolbar + Data Grid */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Toolbar */}
        <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-neutral-900">
          <div className="flex items-center gap-2.5">
            <span className="font-mono font-semibold text-sm text-neutral-900 dark:text-neutral-100">
              {selectedTable}
            </span>
            {tableData && (
              <span className="text-[11px] text-neutral-500">
                ({tableData.totalCount} {t.dev.tablesTab.recordsCount})
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowDdl(!showDdl)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
                showDdl
                  ? 'border-neutral-400 dark:border-neutral-600 bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                  : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
              title={t.dev.tablesTab.ddlTooltip}
            >
              <Code2 className="w-3 h-3" />
              <span>{t.dev.tablesTab.ddlBtn}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t.dev.tablesTab.searchPlaceholder}
                className="w-full pl-8 pr-6 py-1.5 rounded-lg text-xs border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={openCreateRow}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 font-medium text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.dev.tablesTab.addRowBtn}</span>
            </button>
          </div>
        </div>

        {/* Optional DDL Schema Banner */}
        {showDdl && currentTableMeta && (
          <div className="px-4 py-2.5 bg-neutral-950 text-neutral-200 border-b border-neutral-800 font-mono text-[11px] whitespace-pre-wrap max-h-36 overflow-y-auto">
            {currentTableMeta.sql}
          </div>
        )}

        {/* Error or Status Notice */}
        {errorMsg && (
          <div className="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs flex items-center justify-between gap-2 border-b border-neutral-300 dark:border-neutral-700">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </span>
            <button type="button" onClick={() => setErrorMsg(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {statusBanner && (
          <div className="px-4 py-1.5 bg-neutral-100 dark:bg-neutral-800/90 text-neutral-700 dark:text-neutral-200 text-xs border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>{statusBanner}</span>
          </div>
        )}

        {/* Main Content Split: Data Grid + Slide-Over Row Editor */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Data Table */}
          <div className="flex-1 overflow-auto">
            {!tableData || tableData.columns.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400">
                {t.dev.tablesTab.noData}
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800">
                  <tr>
                    <th className="py-2 px-3 font-semibold text-neutral-500 w-20">
                      {t.dev.tablesTab.actionsCol}
                    </th>
                    {tableData.columns.map((col) => (
                      <th
                        key={col.name}
                        className="py-2 px-3 font-mono font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap border-l border-neutral-200/70 dark:border-neutral-800"
                      >
                        <div className="flex items-center gap-1">
                          {col.pk && <Key className="w-3 h-3 text-neutral-500" />}
                          <span>{col.name}</span>
                          <span className="text-[10px] font-normal text-neutral-400">
                            {col.type}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
                  {tableData.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={tableData.columns.length + 1}
                        className="py-10 text-center text-neutral-400"
                      >
                        {t.dev.tablesTab.emptyTable}
                      </td>
                    </tr>
                  ) : (
                    tableData.rows.map((row, rIdx) => {
                      const pk = getRowPrimaryKey(row, tableData.primaryKey);
                      const isRowSelected =
                        editorMode === 'edit' && editingPkValue === pk.val;

                      return (
                        <tr
                          key={`${pk.val}-${rIdx}`}
                          onClick={() => openEditRow(row)}
                          className={`cursor-pointer transition-colors ${
                            isRowSelected
                              ? 'bg-neutral-200/70 dark:bg-neutral-800'
                              : 'hover:bg-neutral-100/70 dark:hover:bg-neutral-900/60'
                          }`}
                        >
                          <td
                            className="py-2 px-3 whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditRow(row)}
                                className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                                title={t.dev.tablesTab.editRowTooltip}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row)}
                                className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                                title={t.dev.tablesTab.deleteRowTooltip}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          {tableData.columns.map((col) => {
                            const val = row[col.name];
                            const displayStr =
                              val === null || val === undefined ? 'NULL' : String(val);
                            return (
                              <td
                                key={col.name}
                                className="py-2 px-3 font-mono text-[11px] max-w-[260px] truncate border-l border-neutral-100 dark:border-neutral-800/60 text-neutral-800 dark:text-neutral-200"
                                title={displayStr.slice(0, 500)}
                              >
                                {val === null || val === undefined ? (
                                  <span className="text-neutral-400 italic">NULL</span>
                                ) : (
                                  displayStr
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Right Drawer: Row Editor / Creator */}
          {editorMode && tableData && (
            <div className="w-96 flex-shrink-0 border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50/90 dark:bg-neutral-950/90 flex flex-col h-full">
              <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                  {editorMode === 'edit'
                    ? `${t.dev.tablesTab.editDrawerTitle} (${editingPkColumn}: ${String(
                        editingPkValue
                      ).slice(0, 14)})`
                    : `${t.dev.tablesTab.createDrawerTitle} ${tableData.tableName}`}
                </div>
                <button
                  type="button"
                  onClick={() => setEditorMode(null)}
                  className="p-1 rounded-lg text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveRowForm} className="flex-1 overflow-y-auto p-4 space-y-3">
                {tableData.columns.map((col) => {
                  const val = formValues[col.name] ?? '';
                  const isLongText =
                    val.length > 65 ||
                    val.includes('\n') ||
                    col.name === 'content' ||
                    col.name === 'thinking' ||
                    col.name === 'instructions' ||
                    col.name === 'compressed_summary' ||
                    col.name === 'value' ||
                    col.name.endsWith('_json');

                  return (
                    <div key={col.name} className="space-y-1">
                      <label className="flex items-center justify-between text-[11px] font-mono">
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1">
                          {col.pk && <Key className="w-3 h-3 text-neutral-500" />}
                          {col.name}
                        </span>
                        <span className="text-neutral-400">
                          {col.type} {col.notnull ? '• NOT NULL' : ''}
                        </span>
                      </label>

                      {isLongText ? (
                        <textarea
                          rows={4}
                          value={val}
                          onChange={(e) =>
                            setFormValues((prev) => ({ ...prev, [col.name]: e.target.value }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono text-[11px] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500 resize-y"
                        />
                      ) : (
                        <input
                          type="text"
                          value={val}
                          onChange={(e) =>
                            setFormValues((prev) => ({ ...prev, [col.name]: e.target.value }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 font-mono text-[11px] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-500"
                        />
                      )}
                    </div>
                  );
                })}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditorMode(null)}
                    className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-neutral-100 dark:text-neutral-900 font-medium text-xs inline-flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{t.dev.tablesTab.saveToDbBtn}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        {tableData && tableData.totalCount > pageSize && (
          <div className="px-4 py-2 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-between text-xs text-neutral-500">
            <span>
              {t.dev.tablesTab.showingRows} {pageOffset + 1}–
              {Math.min(pageOffset + pageSize, tableData.totalCount)} {t.dev.tablesTab.ofRows}{' '}
              {tableData.totalCount}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pageOffset === 0}
                onClick={() => handlePageChange(Math.max(0, pageOffset - pageSize))}
                className="p-1 rounded border border-neutral-200 dark:border-neutral-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={pageOffset + pageSize >= tableData.totalCount}
                onClick={() => handlePageChange(pageOffset + pageSize)}
                className="p-1 rounded border border-neutral-200 dark:border-neutral-800 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
