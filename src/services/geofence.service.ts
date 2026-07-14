import pool from '../db';
import crypto from 'crypto';

export const getGeofences = async (companyId: string, skip?: number, limit?: number) => {
  const res = await pool.query('SELECT * FROM "Geofence" WHERE "companyId" = $1 ORDER BY "createdAt" DESC', [companyId]);
  return res.rows;
};

export const createGeofence = async (companyId: string, data: any) => {
  const id = crypto.randomUUID();
  const res = await pool.query(
    'INSERT INTO "Geofence" (id, "companyId", name, type, coordinates, radius, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
    [id, companyId, data.name, data.type, JSON.stringify(data.coordinates), data.radius || null]
  );
  return res.rows[0];
};

export const getGeofenceById = async (geofenceId: string, companyId: string) => {
  const res = await pool.query('SELECT * FROM "Geofence" WHERE id = $1 AND "companyId" = $2', [geofenceId, companyId]);
  if (res.rows.length === 0) {
    throw new Error('Geofence not found');
  }
  return res.rows[0];
};

export const updateGeofence = async (geofenceId: string, companyId: string, data: any) => {
  const check = await pool.query('SELECT id FROM "Geofence" WHERE id = $1 AND "companyId" = $2', [geofenceId, companyId]);
  if (check.rows.length === 0) {
    throw new Error('Geofence not found');
  }

  const updates = [];
  const values = [];
  let paramIdx = 1;

  if (data.name !== undefined) { updates.push(`name = $${paramIdx++}`); values.push(data.name); }
  if (data.type !== undefined) { updates.push(`type = $${paramIdx++}`); values.push(data.type); }
  if (data.coordinates !== undefined) { updates.push(`coordinates = $${paramIdx++}`); values.push(JSON.stringify(data.coordinates)); }
  if (data.radius !== undefined) { updates.push(`radius = $${paramIdx++}`); values.push(data.radius); }

  if (updates.length === 0) return getGeofenceById(geofenceId, companyId);

  updates.push(`"updatedAt" = NOW()`);
  values.push(geofenceId);
  values.push(companyId);

  const res = await pool.query(
    `UPDATE "Geofence" SET ${updates.join(', ')} WHERE id = $${paramIdx} AND "companyId" = $${paramIdx + 1} RETURNING *`,
    values
  );
  return res.rows[0];
};

export const deleteGeofence = async (geofenceId: string, companyId: string) => {
  const check = await pool.query('SELECT id FROM "Geofence" WHERE id = $1 AND "companyId" = $2', [geofenceId, companyId]);
  if (check.rows.length === 0) {
    throw new Error('Geofence not found');
  }
  await pool.query('DELETE FROM "Geofence" WHERE id = $1', [geofenceId]);
  return { message: 'Geofence deleted successfully' };
};
