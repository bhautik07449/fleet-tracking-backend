import pool from '../db';
import crypto from 'crypto';

export const createShareLink = async (vehicleId: string, companyId: string, durationHours: number = 2) => {
  // Check vehicle ownership
  const check = await pool.query(
    'SELECT id FROM "Vehicle" WHERE id = $1 AND "companyId" = $2',
    [vehicleId, companyId]
  );

  if (check.rows.length === 0) {
    throw new Error('Vehicle not found or unauthorized');
  }

  const id = crypto.randomUUID();
  const token = crypto.randomBytes(10).toString('hex'); // 20 character hex string
  const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000);

  const res = await pool.query(
    `INSERT INTO "SharedLink" (id, "companyId", "vehicleId", token, "expiresAt")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, companyId, vehicleId, token, expiresAt]
  );

  return res.rows[0];
};

export const getSharedVehicleByToken = async (token: string) => {
  const query = `
    SELECT 
      s.id as "shareId",
      s.token,
      s."expiresAt",
      s."vehicleId",
      v."vehicleNumber",
      v.type,
      v.model,
      v.status,
      d.name as "driverName",
      d."contactInfo" as "driverPhone",
      g.imei,
      g."lastLatitude",
      g."lastLongitude",
      g."lastSpeed",
      g."lastSeen",
      c.name as "companyName"
    FROM "SharedLink" s
    JOIN "Vehicle" v ON s."vehicleId" = v.id
    JOIN "Company" c ON v."companyId" = c.id
    LEFT JOIN "Driver" d ON v."driverId" = d.id
    LEFT JOIN "GpsDevice" g ON v."gpsDeviceId" = g.id
    WHERE s.token = $1
  `;

  const res = await pool.query(query, [token]);

  if (res.rows.length === 0) {
    throw new Error('Invalid tracking link');
  }

  const data = res.rows[0];
  const now = new Date();

  if (new Date(data.expiresAt) < now) {
    throw new Error('This shared tracking link has expired');
  }

  return data;
};
