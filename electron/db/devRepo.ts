import fs from 'node:fs';
import type {
  DbColumnSchema,
  DbTableInfo,
  DbTableRowsResponse,
  SqlQueryExecutionResult,
} from '../../src/types/chat';
import { getDb, getDbFilePath, persistDatabase } from './core';

function quoteIdentifier(identifier: string): string {
  // Sanitize identifier by doubling quotes
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function getDatabaseFileStats(): {
  filePath: string;
  sizeBytes: number;
  tableCount: number;
} {
  const filePath = getDbFilePath();
  let sizeBytes = 0;
  try {
    if (filePath && fs.existsSync(filePath)) {
      sizeBytes = fs.statSync(filePath).size;
    }
  } catch {
    sizeBytes = 0;
  }
  const tables = listDbTables();
  return {
    filePath,
    sizeBytes,
    tableCount: tables.length,
  };
}

export function getTableSchema(tableName: string): DbColumnSchema[] {
  const db = getDb();
  if (!db) return [];
  const stmt = db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`);
  const cols: DbColumnSchema[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    cols.push({
      name: String(row.name),
      type: String(row.type || 'TEXT'),
      notnull: Boolean(Number(row.notnull || 0)),
      pk: Number(row.pk || 0) > 0,
      dfltValue: row.dflt_value ?? null,
    });
  }
  stmt.free();
  return cols;
}

export function listDbTables(): DbTableInfo[] {
  const db = getDb();
  if (!db) return [];
  const stmt = db.prepare(
    `SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC`
  );
  const rawTables: Array<{ name: string; sql: string }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    rawTables.push({
      name: String(row.name),
      sql: String(row.sql || ''),
    });
  }
  stmt.free();

  return rawTables.map((t) => {
    let rowCount = 0;
    try {
      const cntStmt = db.prepare(`SELECT COUNT(*) as cnt FROM ${quoteIdentifier(t.name)}`);
      if (cntStmt.step()) {
        const cntRow = cntStmt.getAsObject() as { cnt?: number };
        rowCount = Number(cntRow.cnt || 0);
      }
      cntStmt.free();
    } catch {
      rowCount = 0;
    }

    const columns = getTableSchema(t.name);
    return {
      name: t.name,
      rowCount,
      sql: t.sql,
      columns,
    };
  });
}

function normalizeSqlValueForTransport(val: unknown): unknown {
  if (val instanceof Uint8Array) {
    return `[BLOB: ${val.byteLength} bytes]`;
  }
  return val;
}

export function getTableRows(payload: {
  tableName: string;
  limit?: number;
  offset?: number;
  search?: string;
}): DbTableRowsResponse {
  const db = getDb();
  const limit = Math.min(Math.max(payload.limit || 200, 1), 1000);
  const offset = Math.max(payload.offset || 0, 0);
  const tableName = payload.tableName;

  if (!db || !tableName) {
    return {
      tableName,
      primaryKey: null,
      columns: [],
      rows: [],
      totalCount: 0,
    };
  }

  const columns = getTableSchema(tableName);
  if (columns.length === 0) {
    throw new Error(`Таблица "${tableName}" не найдена`);
  }

  const pkCol = columns.find((c) => c.pk)?.name || null;
  const quotedTable = quoteIdentifier(tableName);
  const search = (payload.search || '').trim();

  let whereClause = '';
  const bindParams: Array<string | number> = [];

  if (search) {
    const conditions = columns.map(
      (col) => `CAST(${quoteIdentifier(col.name)} AS TEXT) LIKE ?`
    );
    whereClause = ` WHERE (${conditions.join(' OR ')}) `;
    const pattern = `%${search}%`;
    for (let i = 0; i < columns.length; i++) {
      bindParams.push(pattern);
    }
  }

  // Count matching rows
  let totalCount = 0;
  const countStmt = db.prepare(`SELECT COUNT(*) as cnt FROM ${quotedTable}${whereClause}`);
  if (bindParams.length > 0) {
    countStmt.bind(bindParams);
  }
  if (countStmt.step()) {
    const cntObj = countStmt.getAsObject() as { cnt?: number };
    totalCount = Number(cntObj.cnt || 0);
  }
  countStmt.free();

  // Order by updated_at / created_at / timestamp if present, else rowid DESC
  const colNames = new Set(columns.map((c) => c.name));
  let orderClause = ' ORDER BY rowid DESC ';
  if (colNames.has('updated_at')) {
    orderClause = ' ORDER BY "updated_at" DESC ';
  } else if (colNames.has('timestamp')) {
    orderClause = ' ORDER BY "timestamp" DESC ';
  } else if (colNames.has('created_at')) {
    orderClause = ' ORDER BY "created_at" DESC ';
  }

  const querySql = `SELECT rowid AS "__rowid__", * FROM ${quotedTable}${whereClause}${orderClause}LIMIT ? OFFSET ?`;
  const stmt = db.prepare(querySql);
  stmt.bind([...bindParams, limit, offset]);

  const rows: Array<Record<string, unknown>> = [];
  while (stmt.step()) {
    const rawObj = stmt.getAsObject() as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawObj)) {
      normalized[k] = normalizeSqlValueForTransport(v);
    }
    rows.push(normalized);
  }
  stmt.free();

  return {
    tableName,
    primaryKey: pkCol,
    columns,
    rows,
    totalCount,
  };
}

export function updateTableRow(payload: {
  tableName: string;
  pkColumn: string;
  pkValue: string | number;
  updates: Record<string, unknown>;
}): { ok: boolean; error?: string } {
  const db = getDb();
  if (!db) return { ok: false, error: 'База данных не инициализирована' };

  const columns = getTableSchema(payload.tableName);
  if (columns.length === 0) {
    return { ok: false, error: `Таблица "${payload.tableName}" не найдена` };
  }

  const validColNames = new Set(columns.map((c) => c.name));
  const entries = Object.entries(payload.updates).filter(([col]) => validColNames.has(col));
  if (entries.length === 0) {
    return { ok: false, error: 'Нет полей для обновления' };
  }

  const setFragments = entries.map(([col]) => `${quoteIdentifier(col)} = ?`);
  const values: Array<string | number | null | Uint8Array> = entries.map(([, val]) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number' || typeof val === 'string') return val;
    if (typeof val === 'boolean') return val ? 1 : 0;
    return JSON.stringify(val);
  });

  const whereCol =
    payload.pkColumn === '__rowid__' ? 'rowid' : quoteIdentifier(payload.pkColumn);

  try {
    db.run(
      `UPDATE ${quoteIdentifier(payload.tableName)} SET ${setFragments.join(', ')} WHERE ${whereCol} = ?`,
      [...values, payload.pkValue]
    );
    persistDatabase();
    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Ошибка обновления записи',
    };
  }
}

export function insertTableRow(payload: {
  tableName: string;
  values: Record<string, unknown>;
}): { ok: boolean; error?: string } {
  const db = getDb();
  if (!db) return { ok: false, error: 'База данных не инициализирована' };

  const columns = getTableSchema(payload.tableName);
  if (columns.length === 0) {
    return { ok: false, error: `Таблица "${payload.tableName}" не найдена` };
  }

  const validColNames = new Set(columns.map((c) => c.name));
  const entries = Object.entries(payload.values).filter(
    ([col, val]) => validColNames.has(col) && val !== undefined && val !== ''
  );

  if (entries.length === 0) {
    return { ok: false, error: 'Заполните хотя бы одно поле' };
  }

  const colNamesSql = entries.map(([col]) => quoteIdentifier(col)).join(', ');
  const placeholders = entries.map(() => '?').join(', ');
  const bindValues: Array<string | number | null> = entries.map(([, val]) => {
    if (val === null) return null;
    if (typeof val === 'number' || typeof val === 'string') return val;
    if (typeof val === 'boolean') return val ? 1 : 0;
    return JSON.stringify(val);
  });

  try {
    db.run(
      `INSERT INTO ${quoteIdentifier(payload.tableName)} (${colNamesSql}) VALUES (${placeholders})`,
      bindValues
    );
    persistDatabase();
    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Ошибка добавления записи',
    };
  }
}

export function deleteTableRow(payload: {
  tableName: string;
  pkColumn: string;
  pkValue: string | number;
}): { ok: boolean; error?: string } {
  const db = getDb();
  if (!db) return { ok: false, error: 'База данных не инициализирована' };

  const whereCol =
    payload.pkColumn === '__rowid__' ? 'rowid' : quoteIdentifier(payload.pkColumn);

  try {
    db.run(
      `DELETE FROM ${quoteIdentifier(payload.tableName)} WHERE ${whereCol} = ?`,
      [payload.pkValue]
    );
    persistDatabase();
    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Ошибка удаления записи',
    };
  }
}

export function executeRawSql(sqlQuery: string): SqlQueryExecutionResult {
  const db = getDb();
  const startTime = performance.now();
  if (!db) {
    return {
      ok: false,
      resultSets: [],
      rowsModified: 0,
      durationMs: 0,
      error: 'База данных не инициализирована',
    };
  }

  const trimmed = sqlQuery.trim();
  if (!trimmed) {
    return {
      ok: false,
      resultSets: [],
      rowsModified: 0,
      durationMs: 0,
      error: 'Пустой SQL-запрос',
    };
  }

  try {
    const rawResults = db.exec(trimmed);
    const rowsModified = db.getRowsModified();

    // Persist to disk if query might have mutated data or schema
    if (
      rowsModified > 0 ||
      /\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|VACUUM|REINDEX)\b/i.test(trimmed)
    ) {
      persistDatabase();
    }

    const resultSets = rawResults.map((rs) => ({
      columns: rs.columns,
      rows: rs.values.map((rowArr) => {
        const obj: Record<string, unknown> = {};
        rs.columns.forEach((colName, idx) => {
          obj[colName] = normalizeSqlValueForTransport(rowArr[idx]);
        });
        return obj;
      }),
    }));

    return {
      ok: true,
      resultSets,
      rowsModified,
      durationMs: Number((performance.now() - startTime).toFixed(2)),
    };
  } catch (err: unknown) {
    return {
      ok: false,
      resultSets: [],
      rowsModified: 0,
      durationMs: Number((performance.now() - startTime).toFixed(2)),
      error: err instanceof Error ? err.message : 'Ошибка выполнения SQL-запроса',
    };
  }
}

export function vacuumDatabase(): { ok: boolean; sizeBytes: number; error?: string } {
  const db = getDb();
  if (!db) return { ok: false, sizeBytes: 0, error: 'БД не инициализирована' };
  try {
    db.run('VACUUM');
    persistDatabase();
    const stats = getDatabaseFileStats();
    return { ok: true, sizeBytes: stats.sizeBytes };
  } catch (err: unknown) {
    return {
      ok: false,
      sizeBytes: 0,
      error: err instanceof Error ? err.message : 'Ошибка VACUUM',
    };
  }
}
