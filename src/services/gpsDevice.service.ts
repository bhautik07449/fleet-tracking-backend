import pool from '../db';
import crypto from 'crypto';

export const getGpsDevices = async (companyId: string, skip?: number, limit?: number) => {
  const res = await pool.query('SELECT * FROM "GpsDevice" WHERE "companyId" = $1 ORDER BY "createdAt" DESC', [companyId]);
  return res.rows;
};

export const getGpsDeviceById = async (deviceId: string, companyId: string) => {
  const res = await pool.query('SELECT * FROM "GpsDevice" WHERE id = $1 AND "companyId" = $2', [deviceId, companyId]);
  if (res.rows.length === 0) {
    throw new Error('GPS Device not found');
  }
  return res.rows[0];
};

export const createGpsDevice = async (companyId: string, data: any) => {
  const existing = await pool.query('SELECT id FROM "GpsDevice" WHERE imei = $1', [data.imei]);
  if (existing.rows.length > 0) {
    throw new Error('GPS Device with this IMEI already exists');
  }

  const id = crypto.randomUUID();
  const res = await pool.query(
    'INSERT INTO "GpsDevice" (id, "companyId", imei, "deviceModel", "simNumber", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
    [id, companyId, data.imei, data.deviceModel, data.simNumber]
  );
  return res.rows[0];
};

export const updateGpsDevice = async (deviceId: string, companyId: string, data: any) => {
  const check = await pool.query('SELECT id FROM "GpsDevice" WHERE id = $1 AND "companyId" = $2', [deviceId, companyId]);
  if (check.rows.length === 0) {
    throw new Error('GPS Device not found');
  }

  if (data.imei) {
    const existing = await pool.query('SELECT id FROM "GpsDevice" WHERE imei = $1 AND id != $2', [data.imei, deviceId]);
    if (existing.rows.length > 0) {
      throw new Error('GPS Device with this IMEI already exists');
    }
  }

  const updates = [];
  const values = [];
  let paramIdx = 1;

  if (data.imei !== undefined) { updates.push(`imei = $${paramIdx++}`); values.push(data.imei); }
  if (data.deviceModel !== undefined) { updates.push(`"deviceModel" = $${paramIdx++}`); values.push(data.deviceModel); }
  if (data.simNumber !== undefined) { updates.push(`"simNumber" = $${paramIdx++}`); values.push(data.simNumber); }
  if (data.status !== undefined) { updates.push(`status = $${paramIdx++}`); values.push(data.status); }

  if (updates.length === 0) return getGpsDeviceById(deviceId, companyId);

  updates.push(`"updatedAt" = NOW()`);
  values.push(deviceId);
  values.push(companyId);

  const res = await pool.query(
    `UPDATE "GpsDevice" SET ${updates.join(', ')} WHERE id = $${paramIdx} AND "companyId" = $${paramIdx + 1} RETURNING *`,
    values
  );
  return res.rows[0];
};

export const deleteGpsDevice = async (deviceId: string, companyId: string) => {
  const check = await pool.query('SELECT id FROM "GpsDevice" WHERE id = $1 AND "companyId" = $2', [deviceId, companyId]);
  if (check.rows.length === 0) {
    throw new Error('GPS Device not found');
  }
  await pool.query('DELETE FROM "GpsDevice" WHERE id = $1', [deviceId]);
  return { message: 'GPS Device deleted successfully' };
};
