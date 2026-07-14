import pool from '../db';
import crypto from 'crypto';

export const getDrivers = async (companyId: string, skip?: number, limit?: number) => {
  const res = await pool.query('SELECT * FROM "Driver" WHERE "companyId" = $1 ORDER BY "createdAt" DESC', [companyId]);
  return res.rows;
};

export const getDriverById = async (driverId: string, companyId: string) => {
  const res = await pool.query('SELECT * FROM "Driver" WHERE id = $1 AND "companyId" = $2', [driverId, companyId]);
  if (res.rows.length === 0) {
    throw new Error('Driver not found');
  }
  return res.rows[0];
};

export const createDriver = async (companyId: string, data: any) => {
  const existing = await pool.query('SELECT id FROM "Driver" WHERE "licenseNumber" = $1', [data.licenseNumber]);
  if (existing.rows.length > 0) {
    throw new Error('Driver with this license number already exists');
  }

  const id = crypto.randomUUID();
  const res = await pool.query(
    'INSERT INTO "Driver" (id, "companyId", name, "licenseNumber", "contactInfo", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
    [id, companyId, data.name, data.licenseNumber, data.contactInfo]
  );
  return res.rows[0];
};

export const updateDriver = async (driverId: string, companyId: string, data: any) => {
  const check = await pool.query('SELECT id FROM "Driver" WHERE id = $1 AND "companyId" = $2', [driverId, companyId]);
  if (check.rows.length === 0) {
    throw new Error('Driver not found');
  }

  if (data.licenseNumber) {
    const existing = await pool.query('SELECT id FROM "Driver" WHERE "licenseNumber" = $1 AND id != $2', [data.licenseNumber, driverId]);
    if (existing.rows.length > 0) {
      throw new Error('Driver with this license number already exists');
    }
  }

  const updates = [];
  const values = [];
  let paramIdx = 1;

  if (data.name !== undefined) { updates.push(`name = $${paramIdx++}`); values.push(data.name); }
  if (data.licenseNumber !== undefined) { updates.push(`"licenseNumber" = $${paramIdx++}`); values.push(data.licenseNumber); }
  if (data.contactInfo !== undefined) { updates.push(`"contactInfo" = $${paramIdx++}`); values.push(data.contactInfo); }

  if (updates.length === 0) return getDriverById(driverId, companyId);

  updates.push(`"updatedAt" = NOW()`);
  values.push(driverId);
  values.push(companyId);

  const res = await pool.query(
    `UPDATE "Driver" SET ${updates.join(', ')} WHERE id = $${paramIdx} AND "companyId" = $${paramIdx + 1} RETURNING *`,
    values
  );
  return res.rows[0];
};

export const deleteDriver = async (driverId: string, companyId: string) => {
  const check = await pool.query('SELECT id FROM "Driver" WHERE id = $1 AND "companyId" = $2', [driverId, companyId]);
  if (check.rows.length === 0) {
    throw new Error('Driver not found');
  }
  await pool.query('DELETE FROM "Driver" WHERE id = $1', [driverId]);
  return { message: 'Driver deleted successfully' };
};
