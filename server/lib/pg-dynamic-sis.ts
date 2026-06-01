import { getPgPool } from "../db-pg";
import {
  type DynamicBase,
  type DynamicTable,
  type DynamicField,
  type DynamicRecord,
  type DynamicView,
  type InsertDynamicBase,
  type InsertDynamicTable,
  type InsertDynamicField,
  type InsertDynamicRecord,
  type InsertDynamicView,
} from "@shared/schema";

// ─── Row Mappers ──────────────────────────────────────────────────────────────

function n(v: any): number | null {
  if (v == null) return null;
  const x = parseInt(v, 10);
  return isNaN(x) ? null : x;
}

function mapBase(r: any): DynamicBase {
  return {
    id: n(r.id)!,
    workspaceId: n(r.workspace_id)!,
    name: r.name,
    description: r.description ?? null,
    icon: r.icon ?? null,
    color: r.color ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapTable(r: any): DynamicTable {
  return {
    id: n(r.id)!,
    baseId: n(r.base_id)!,
    name: r.name,
    description: r.description ?? null,
    icon: r.icon ?? null,
    ord: n(r.ord)!,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapField(r: any): DynamicField {
  return {
    id: n(r.id)!,
    tableId: n(r.table_id)!,
    name: r.name,
    type: r.type as any,
    config: r.config ?? {},
    ord: n(r.ord)!,
    isPrimary: r.is_primary ?? false,
    isHidden: r.is_hidden ?? false,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapRecord(r: any): DynamicRecord {
  return {
    id: r.id,
    tableId: n(r.table_id)!,
    data: r.data ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapView(r: any): DynamicView {
  return {
    id: n(r.id)!,
    tableId: n(r.table_id)!,
    name: r.name,
    type: r.type as any,
    config: r.config ?? {},
    filter: r.filter ?? {},
    sort: r.sort ?? [],
    ord: n(r.ord)!,
    createdAt: r.created_at,
  };
}

// ─── Bases ───────────────────────────────────────────────────────────────────

export async function pgListBases(workspaceId: number): Promise<DynamicBase[]> {
  const pool = getPgPool();
  const res = await pool.query(
    "SELECT * FROM dynamic_bases WHERE workspace_id = $1 ORDER BY name ASC",
    [workspaceId]
  );
  return res.rows.map(mapBase);
}

export async function pgFindBaseById(id: number): Promise<DynamicBase | null> {
  const pool = getPgPool();
  const res = await pool.query("SELECT * FROM dynamic_bases WHERE id = $1", [id]);
  return res.rows[0] ? mapBase(res.rows[0]) : null;
}

export async function pgCreateBase(base: InsertDynamicBase): Promise<DynamicBase> {
  const pool = getPgPool();
  const res = await pool.query(
    `INSERT INTO dynamic_bases (workspace_id, name, description, icon, color)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [base.workspaceId, base.name, base.description, base.icon, base.color]
  );
  return mapBase(res.rows[0]);
}

export async function pgUpdateBase(
  id: number,
  patch: Partial<InsertDynamicBase>
): Promise<DynamicBase | null> {
  const pool = getPgPool();
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (patch.name !== undefined) {
    sets.push(`name = $${i++}`);
    vals.push(patch.name);
  }
  if (patch.description !== undefined) {
    sets.push(`description = $${i++}`);
    vals.push(patch.description);
  }
  if (patch.icon !== undefined) {
    sets.push(`icon = $${i++}`);
    vals.push(patch.icon);
  }
  if (patch.color !== undefined) {
    sets.push(`color = $${i++}`);
    vals.push(patch.color);
  }

  if (sets.length === 0) return pgFindBaseById(id);

  vals.push(id);
  const res = await pool.query(
    `UPDATE dynamic_bases SET ${sets.join(", ")}, updated_at = now() WHERE id = $${i} RETURNING *`,
    vals
  );
  return res.rows[0] ? mapBase(res.rows[0]) : null;
}

export async function pgDeleteBase(id: number): Promise<void> {
  const pool = getPgPool();
  await pool.query("DELETE FROM dynamic_bases WHERE id = $1", [id]);
}

// ─── Tables ──────────────────────────────────────────────────────────────────

export async function pgListTables(baseId: number): Promise<DynamicTable[]> {
  const pool = getPgPool();
  const res = await pool.query(
    "SELECT * FROM dynamic_tables WHERE base_id = $1 ORDER BY ord ASC, name ASC",
    [baseId]
  );
  return res.rows.map(mapTable);
}

export async function pgFindTableById(id: number): Promise<DynamicTable | null> {
  const pool = getPgPool();
  const res = await pool.query("SELECT * FROM dynamic_tables WHERE id = $1", [id]);
  return res.rows[0] ? mapTable(res.rows[0]) : null;
}

export async function pgCreateTable(table: InsertDynamicTable): Promise<DynamicTable> {
  const pool = getPgPool();
  const res = await pool.query(
    `INSERT INTO dynamic_tables (base_id, name, description, icon, ord)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [table.baseId, table.name, table.description, table.icon, table.ord]
  );
  return mapTable(res.rows[0]);
}

export async function pgUpdateTable(
  id: number,
  patch: Partial<InsertDynamicTable>
): Promise<DynamicTable | null> {
  const pool = getPgPool();
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (patch.name !== undefined) {
    sets.push(`name = $${i++}`);
    vals.push(patch.name);
  }
  if (patch.description !== undefined) {
    sets.push(`description = $${i++}`);
    vals.push(patch.description);
  }
  if (patch.icon !== undefined) {
    sets.push(`icon = $${i++}`);
    vals.push(patch.icon);
  }
  if (patch.ord !== undefined) {
    sets.push(`ord = $${i++}`);
    vals.push(patch.ord);
  }

  if (sets.length === 0) return pgFindTableById(id);

  vals.push(id);
  const res = await pool.query(
    `UPDATE dynamic_tables SET ${sets.join(", ")}, updated_at = now() WHERE id = $${i} RETURNING *`,
    vals
  );
  return res.rows[0] ? mapTable(res.rows[0]) : null;
}

export async function pgDeleteTable(id: number): Promise<void> {
  const pool = getPgPool();
  await pool.query("DELETE FROM dynamic_tables WHERE id = $1", [id]);
}

// ─── Fields ──────────────────────────────────────────────────────────────────

export async function pgListFields(tableId: number): Promise<DynamicField[]> {
  const pool = getPgPool();
  const res = await pool.query(
    "SELECT * FROM dynamic_fields WHERE table_id = $1 ORDER BY ord ASC",
    [tableId]
  );
  return res.rows.map(mapField);
}

export async function pgFindFieldById(id: number): Promise<DynamicField | null> {
  const pool = getPgPool();
  const res = await pool.query("SELECT * FROM dynamic_fields WHERE id = $1", [id]);
  return res.rows[0] ? mapField(res.rows[0]) : null;
}

export async function pgCreateField(field: InsertDynamicField): Promise<DynamicField> {
  const pool = getPgPool();
  const res = await pool.query(
    `INSERT INTO dynamic_fields (table_id, name, type, config, ord, is_primary, is_hidden)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      field.tableId,
      field.name,
      field.type,
      field.config,
      field.ord,
      field.isPrimary,
      field.isHidden,
    ]
  );
  return mapField(res.rows[0]);
}

export async function pgUpdateField(
  id: number,
  patch: Partial<InsertDynamicField>
): Promise<DynamicField | null> {
  const pool = getPgPool();
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (patch.name !== undefined) {
    sets.push(`name = $${i++}`);
    vals.push(patch.name);
  }
  if (patch.type !== undefined) {
    sets.push(`type = $${i++}`);
    vals.push(patch.type);
  }
  if (patch.config !== undefined) {
    sets.push(`config = $${i++}`);
    vals.push(patch.config);
  }
  if (patch.ord !== undefined) {
    sets.push(`ord = $${i++}`);
    vals.push(patch.ord);
  }
  if (patch.isPrimary !== undefined) {
    sets.push(`is_primary = $${i++}`);
    vals.push(patch.isPrimary);
  }
  if (patch.isHidden !== undefined) {
    sets.push(`is_hidden = $${i++}`);
    vals.push(patch.isHidden);
  }

  if (sets.length === 0) return pgFindFieldById(id);

  vals.push(id);
  const res = await pool.query(
    `UPDATE dynamic_fields SET ${sets.join(", ")}, updated_at = now() WHERE id = $${i} RETURNING *`,
    vals
  );
  return res.rows[0] ? mapField(res.rows[0]) : null;
}

export async function pgDeleteField(id: number): Promise<void> {
  const pool = getPgPool();
  await pool.query("DELETE FROM dynamic_fields WHERE id = $1", [id]);
}

// ─── Records ─────────────────────────────────────────────────────────────────

export async function pgListRecords(tableId: number): Promise<DynamicRecord[]> {
  const pool = getPgPool();
  const res = await pool.query(
    "SELECT * FROM dynamic_records WHERE table_id = $1 ORDER BY created_at ASC",
    [tableId]
  );
  return res.rows.map(mapRecord);
}

export async function pgFindRecordById(id: string): Promise<DynamicRecord | null> {
  const pool = getPgPool();
  const res = await pool.query("SELECT * FROM dynamic_records WHERE id = $1", [id]);
  return res.rows[0] ? mapRecord(res.rows[0]) : null;
}

export async function pgCreateRecord(record: InsertDynamicRecord): Promise<DynamicRecord> {
  const pool = getPgPool();
  const res = await pool.query(
    `INSERT INTO dynamic_records (table_id, data)
     VALUES ($1, $2)
     RETURNING *`,
    [record.tableId, record.data]
  );
  return mapRecord(res.rows[0]);
}

export async function pgBulkCreateRecords(
  tableId: number,
  records: Record<string, any>[]
): Promise<void> {
  const pool = getPgPool();
  if (records.length === 0) return;

  // Simple implementation using multiple inserts in one transaction or a batch
  // For better performance with large datasets, use a single query with unnest or COPY
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const data of records) {
      await client.query("INSERT INTO dynamic_records (table_id, data) VALUES ($1, $2)", [
        tableId,
        data,
      ]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function pgUpdateRecord(
  id: string,
  data: Record<string, any>
): Promise<DynamicRecord | null> {
  const pool = getPgPool();
  const res = await pool.query(
    `UPDATE dynamic_records SET data = data || $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [data, id]
  );
  return res.rows[0] ? mapRecord(res.rows[0]) : null;
}

export async function pgDeleteRecord(id: string): Promise<void> {
  const pool = getPgPool();
  await pool.query("DELETE FROM dynamic_records WHERE id = $1", [id]);
}

// ─── Views ───────────────────────────────────────────────────────────────────

export async function pgListViews(tableId: number): Promise<DynamicView[]> {
  const pool = getPgPool();
  const res = await pool.query("SELECT * FROM dynamic_views WHERE table_id = $1 ORDER BY ord ASC", [
    tableId,
  ]);
  return res.rows.map(mapView);
}

export async function pgCreateView(view: InsertDynamicView): Promise<DynamicView> {
  const pool = getPgPool();
  const res = await pool.query(
    `INSERT INTO dynamic_views (table_id, name, type, config, filter, sort, ord)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [view.tableId, view.name, view.type, view.config, view.filter, view.sort, view.ord]
  );
  return mapView(res.rows[0]);
}

export async function pgUpdateView(
  id: number,
  patch: Partial<InsertDynamicView>
): Promise<DynamicView | null> {
  const pool = getPgPool();
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (patch.name !== undefined) {
    sets.push(`name = $${i++}`);
    vals.push(patch.name);
  }
  if (patch.type !== undefined) {
    sets.push(`type = $${i++}`);
    vals.push(patch.type);
  }
  if (patch.config !== undefined) {
    sets.push(`config = $${i++}`);
    vals.push(patch.config);
  }
  if (patch.filter !== undefined) {
    sets.push(`filter = $${i++}`);
    vals.push(patch.filter);
  }
  if (patch.sort !== undefined) {
    sets.push(`sort = $${i++}`);
    vals.push(patch.sort);
  }
  if (patch.ord !== undefined) {
    sets.push(`ord = $${i++}`);
    vals.push(patch.ord);
  }

  if (sets.length === 0) return null; // Or fetch existing

  vals.push(id);
  const res = await pool.query(
    `UPDATE dynamic_views SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
    vals
  );
  return res.rows[0] ? mapView(res.rows[0]) : null;
}

export async function pgDeleteView(id: number): Promise<void> {
  const pool = getPgPool();
  await pool.query("DELETE FROM dynamic_views WHERE id = $1", [id]);
}
