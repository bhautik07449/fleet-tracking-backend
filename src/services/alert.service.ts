import pool from '../db';

export const getAlerts = async (companyId: string, skip?: number, limit?: number, isResolved?: boolean) => {
  const res = await pool.query(`
    SELECT a.*, 
      json_build_object('id', v.id, 'vehicleNumber', v."vehicleNumber") as vehicle
    FROM "Alert" a
    JOIN "Vehicle" v ON a."vehicleId" = v.id
    WHERE v."companyId" = $1 ORDER BY a."createdAt" DESC
  `, [companyId]);

  // Map isRead to isResolved to match frontend expectations
  return res.rows.map(row => ({
    ...row,
    isResolved: row.isRead
  }));
};

export const resolveAlert = async (alertId: string, companyId: string) => {
  const check = await pool.query(`
    SELECT a.id FROM "Alert" a
    JOIN "Vehicle" v ON a."vehicleId" = v.id
    WHERE a.id = $1 AND v."companyId" = $2
  `, [alertId, companyId]);

  if (check.rows.length === 0) {
    throw new Error('Alert not found');
  }

  const res = await pool.query('UPDATE "Alert" SET "isRead" = true WHERE id = $1 RETURNING *', [alertId]);
  return res.rows[0];
};

export const createSystemAlert = async (vehicleId: string, companyId: string, type: string, message: string) => {
  const id = require('crypto').randomUUID();
  const res = await pool.query(
    'INSERT INTO "Alert" (id, "vehicleId", type, message) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, vehicleId, type, message]
  );
  return res.rows[0];
};

export const deleteAlert = async (alertId: string, companyId: string) => {
  const check = await pool.query(`
    SELECT a.id FROM "Alert" a
    JOIN "Vehicle" v ON a."vehicleId" = v.id
    WHERE a.id = $1 AND v."companyId" = $2
  `, [alertId, companyId]);

  if (check.rows.length === 0) {
    throw new Error('Alert not found');
  }
  await pool.query('DELETE FROM "Alert" WHERE id = $1', [alertId]);
  return { message: 'Alert deleted successfully' };
};

