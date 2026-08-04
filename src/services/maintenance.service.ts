import pool from '../db';
import crypto from 'crypto';

export const getReminders = async (companyId: string, vehicleId?: string) => {
  let query = `
    SELECT 
      m.*,
      v."vehicleNumber",
      v.type as "vehicleType",
      v.model as "vehicleModel"
    FROM "MaintenanceReminder" m
    JOIN "Vehicle" v ON m."vehicleId" = v.id
    WHERE m."companyId" = $1
  `;
  const params: any[] = [companyId];

  if (vehicleId) {
    query += ` AND m."vehicleId" = $2`;
    params.push(vehicleId);
  }

  query += ` ORDER BY m."status" = 'EXPIRED' DESC, m."status" = 'DUE_SOON' DESC, m."dueDate" ASC NULLS LAST, m."createdAt" DESC`;

  const res = await pool.query(query, params);
  const rows = res.rows;

  const now = new Date();
  const fifteenDaysFromNow = new Date(Date.now() + 15 * 24 * 3600 * 1000);

  // Auto-calculate expiration and update status if needed
  for (const row of rows) {
    if (row.status !== 'COMPLETED' && row.dueDate) {
      const due = new Date(row.dueDate);
      let computedStatus = 'ACTIVE';
      if (due < now) {
        computedStatus = 'EXPIRED';
      } else if (due <= fifteenDaysFromNow) {
        computedStatus = 'DUE_SOON';
      }

      if (computedStatus !== row.status) {
        row.status = computedStatus;
        await pool.query('UPDATE "MaintenanceReminder" SET status = $1, "updatedAt" = NOW() WHERE id = $2', [computedStatus, row.id]);
      }
    }
  }

  return rows;
};

export const createReminder = async (data: any, companyId: string) => {
  // Validate vehicle ownership
  const check = await pool.query('SELECT id FROM "Vehicle" WHERE id = $1 AND "companyId" = $2', [data.vehicleId, companyId]);
  if (check.rows.length === 0) {
    throw new Error('Vehicle not found in your account');
  }

  const id = crypto.randomUUID();
  const res = await pool.query(
    `INSERT INTO "MaintenanceReminder" (id, "companyId", "vehicleId", title, category, "dueDate", "dueDistance", notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      id, companyId, data.vehicleId, data.title, data.category || 'SERVICE',
      data.dueDate ? new Date(data.dueDate) : null,
      data.dueDistance ? parseFloat(data.dueDistance) : null,
      data.notes || null
    ]
  );
  return res.rows[0];
};

export const updateReminder = async (id: string, companyId: string, data: any) => {
  const check = await pool.query('SELECT id FROM "MaintenanceReminder" WHERE id = $1 AND "companyId" = $2', [id, companyId]);
  if (check.rows.length === 0) {
    throw new Error('Reminder not found');
  }

  const res = await pool.query(
    `UPDATE "MaintenanceReminder"
     SET title = COALESCE($1, title),
         category = COALESCE($2, category),
         "dueDate" = COALESCE($3, "dueDate"),
         "dueDistance" = COALESCE($4, "dueDistance"),
         status = COALESCE($5, status),
         notes = COALESCE($6, notes),
         "updatedAt" = NOW()
     WHERE id = $7 AND "companyId" = $8
     RETURNING *`,
    [
      data.title, data.category, data.dueDate ? new Date(data.dueDate) : undefined,
      data.dueDistance, data.status, data.notes, id, companyId
    ]
  );
  return res.rows[0];
};

export const deleteReminder = async (id: string, companyId: string) => {
  const res = await pool.query('DELETE FROM "MaintenanceReminder" WHERE id = $1 AND "companyId" = $2 RETURNING id', [id, companyId]);
  if (res.rows.length === 0) {
    throw new Error('Reminder not found or already deleted');
  }
  return { id };
};
