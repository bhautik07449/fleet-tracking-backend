import pool from '../db';
import crypto from 'crypto';

export const getVehicles = async (companyId: string, skip?: number, limit?: number) => {
  const res = await pool.query(`
    SELECT v.*, 
      json_build_object('id', d.id, 'name', d.name) as driver,
      json_build_object('id', g.id, 'imei', g.imei) as "gpsDevice",
      COALESCE(v."lastLatitude", loc.latitude, g."lastLatitude") as "lastLatitude",
      COALESCE(v."lastLongitude", loc.longitude, g."lastLongitude") as "lastLongitude",
      COALESCE(v."lastSpeed", loc.speed, g."lastSpeed", 0) as "lastSpeed",
      COALESCE(v."maxSpeed", 80) as "maxSpeed"
    FROM "Vehicle" v
    LEFT JOIN "Driver" d ON v."driverId" = d.id
    LEFT JOIN "GpsDevice" g ON v."gpsDeviceId" = g.id
    LEFT JOIN LATERAL (
      SELECT latitude, longitude, speed FROM "VehicleLocation"
      WHERE "vehicleId" = v.id
      ORDER BY timestamp DESC LIMIT 1
    ) loc ON true
    WHERE v."companyId" = $1 ORDER BY v."createdAt" DESC
  `, [companyId]);
  return res.rows;
};

export const getVehicleById = async (vehicleId: string, companyId: string) => {
  const res = await pool.query(`
    SELECT v.*, 
      json_build_object('id', d.id, 'name', d.name) as driver,
      json_build_object('id', g.id, 'imei', g.imei) as "gpsDevice",
      COALESCE(v."lastLatitude", loc.latitude, g."lastLatitude") as "lastLatitude",
      COALESCE(v."lastLongitude", loc.longitude, g."lastLongitude") as "lastLongitude",
      COALESCE(v."lastSpeed", loc.speed, g."lastSpeed", 0) as "lastSpeed",
      COALESCE(v."maxSpeed", 80) as "maxSpeed"
    FROM "Vehicle" v
    LEFT JOIN "Driver" d ON v."driverId" = d.id
    LEFT JOIN "GpsDevice" g ON v."gpsDeviceId" = g.id
    LEFT JOIN LATERAL (
      SELECT latitude, longitude, speed FROM "VehicleLocation"
      WHERE "vehicleId" = v.id
      ORDER BY timestamp DESC LIMIT 1
    ) loc ON true
    WHERE v.id = $1 AND v."companyId" = $2
  `, [vehicleId, companyId]);
  if (res.rows.length === 0) {
    throw new Error('Vehicle not found');
  }
  return res.rows[0];
};

export const createVehicle = async (companyId: string, data: any) => {
  const existing = await pool.query('SELECT id FROM "Vehicle" WHERE "vehicleNumber" = $1', [data.vehicleNumber]);
  if (existing.rows.length > 0) {
    throw new Error('Vehicle with this number already exists');
  }

  if (data.gpsDeviceId) {
    const existingDevice = await pool.query('SELECT id FROM "Vehicle" WHERE "gpsDeviceId" = $1', [data.gpsDeviceId]);
    if (existingDevice.rows.length > 0) {
      throw new Error('This GPS device is already assigned to another vehicle');
    }
  }

  const id = crypto.randomUUID();
  const res = await pool.query(
    'INSERT INTO "Vehicle" (id, "companyId", "vehicleNumber", type, model, "maxSpeed", "driverId", "gpsDeviceId", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *',
    [id, companyId, data.vehicleNumber, data.type, data.model, data.maxSpeed ? Number(data.maxSpeed) : 80, data.driverId || null, data.gpsDeviceId || null]
  );
  return res.rows[0];
};

export const updateVehicle = async (vehicleId: string, companyId: string, data: any) => {
  const check = await pool.query('SELECT id FROM "Vehicle" WHERE id = $1 AND "companyId" = $2', [vehicleId, companyId]);
  if (check.rows.length === 0) {
    throw new Error('Vehicle not found');
  }

  if (data.vehicleNumber) {
    const existing = await pool.query('SELECT id FROM "Vehicle" WHERE "vehicleNumber" = $1 AND id != $2', [data.vehicleNumber, vehicleId]);
    if (existing.rows.length > 0) {
      throw new Error('Vehicle with this number already exists');
    }
  }

  if (data.gpsDeviceId) {
    const existingDevice = await pool.query('SELECT id FROM "Vehicle" WHERE "gpsDeviceId" = $1 AND id != $2', [data.gpsDeviceId, vehicleId]);
    if (existingDevice.rows.length > 0) {
      throw new Error('This GPS device is already assigned to another vehicle');
    }
  }

  const updates = [];
  const values = [];
  let paramIdx = 1;

  if (data.vehicleNumber !== undefined) { updates.push(`"vehicleNumber" = $${paramIdx++}`); values.push(data.vehicleNumber); }
  if (data.type !== undefined) { updates.push(`type = $${paramIdx++}`); values.push(data.type); }
  if (data.model !== undefined) { updates.push(`model = $${paramIdx++}`); values.push(data.model); }
  if (data.status !== undefined) { updates.push(`status = $${paramIdx++}`); values.push(data.status); }
  if (data.driverId !== undefined) { updates.push(`"driverId" = $${paramIdx++}`); values.push(data.driverId); }
  if (data.gpsDeviceId !== undefined) { updates.push(`"gpsDeviceId" = $${paramIdx++}`); values.push(data.gpsDeviceId); }
  if (data.maxSpeed !== undefined) { updates.push(`"maxSpeed" = $${paramIdx++}`); values.push(Number(data.maxSpeed)); }

  if (updates.length === 0) return getVehicleById(vehicleId, companyId);

  updates.push(`"updatedAt" = NOW()`);
  values.push(vehicleId);
  values.push(companyId);

  await pool.query(
    `UPDATE "Vehicle" SET ${updates.join(', ')} WHERE id = $${paramIdx} AND "companyId" = $${paramIdx + 1}`,
    values
  );

  return getVehicleById(vehicleId, companyId);
};

export const deleteVehicle = async (vehicleId: string, companyId: string) => {
  const check = await pool.query('SELECT id FROM "Vehicle" WHERE id = $1 AND "companyId" = $2', [vehicleId, companyId]);
  if (check.rows.length === 0) {
    throw new Error('Vehicle not found');
  }
  await pool.query('DELETE FROM "Vehicle" WHERE id = $1', [vehicleId]);
  return { message: 'Vehicle deleted successfully' };
};

export const getVehicleLocationHistory = async (vehicleId: string, companyId: string, hours: number = 24) => {
  const check = await pool.query('SELECT id, "vehicleNumber" FROM "Vehicle" WHERE id = $1 AND "companyId" = $2', [vehicleId, companyId]);
  if (check.rows.length === 0) {
    throw new Error('Vehicle not found');
  }
  
  const res = await pool.query(`
    SELECT latitude, longitude, speed, heading, timestamp, "ignitionStatus", altitude 
    FROM "VehicleLocation"
    WHERE "vehicleId" = $1 AND timestamp >= NOW() - INTERVAL '1 hour' * $2
    ORDER BY timestamp ASC
  `, [vehicleId, hours]);
  
  return {
    vehicleId,
    vehicleNumber: check.rows[0].vehicleNumber,
    hours,
    count: res.rows.length,
    locations: res.rows
  };
};
