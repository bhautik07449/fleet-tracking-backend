import pool from '../db';
import crypto from 'crypto';

export const getTrips = async (companyId: string, skip?: number, limit?: number) => {
  const res = await pool.query(`
    SELECT t.*, 
      json_build_object('id', v.id, 'vehicleNumber', v."vehicleNumber") as vehicle
    FROM "Trip" t
    JOIN "Vehicle" v ON t."vehicleId" = v.id
    WHERE v."companyId" = $1 ORDER BY t."createdAt" DESC
  `, [companyId]);
  return res.rows;
};

export const startTrip = async (vehicleId: string, companyId: string, startLocation: any) => {
  const vCheck = await pool.query('SELECT id FROM "Vehicle" WHERE id = $1 AND "companyId" = $2', [vehicleId, companyId]);
  if (vCheck.rows.length === 0) {
    throw new Error('Vehicle not found');
  }

  const ongoingCheck = await pool.query('SELECT id FROM "Trip" WHERE "vehicleId" = $1 AND status = $2', [vehicleId, 'ONGOING']);
  if (ongoingCheck.rows.length > 0) {
    throw new Error('Vehicle already has an ongoing trip');
  }

  const id = crypto.randomUUID();
  const res = await pool.query(
    'INSERT INTO "Trip" (id, "vehicleId", "startLocation", status, "updatedAt") VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
    [id, vehicleId, JSON.stringify(startLocation), 'ONGOING']
  );
  return res.rows[0];
};

export const endTrip = async (tripId: string, companyId: string, endLocation: any) => {
  const check = await pool.query(`
    SELECT t.* FROM "Trip" t
    JOIN "Vehicle" v ON t."vehicleId" = v.id
    WHERE t.id = $1 AND v."companyId" = $2
  `, [tripId, companyId]);

  if (check.rows.length === 0) {
    throw new Error('Trip not found');
  }

  const trip = check.rows[0];
  if (trip.status !== 'ONGOING') {
    throw new Error('Trip is not ongoing');
  }

  // Calculate duration
  const startTime = new Date(trip.startTime).getTime();
  const endTime = new Date().getTime();
  const duration = Math.floor((endTime - startTime) / 1000);

  const res = await pool.query(`
    UPDATE "Trip" 
    SET "endLocation" = $1, status = $2, "endTime" = NOW(), duration = $3, "updatedAt" = NOW()
    WHERE id = $4 RETURNING *
  `, [JSON.stringify(endLocation), 'COMPLETED', duration, tripId]);

  return res.rows[0];
};

export const getTripById = async (tripId: string, companyId: string) => {
  const check = await pool.query(`
    SELECT t.* FROM "Trip" t
    JOIN "Vehicle" v ON t."vehicleId" = v.id
    WHERE t.id = $1 AND v."companyId" = $2
  `, [tripId, companyId]);

  if (check.rows.length === 0) {
    throw new Error('Trip not found');
  }
  return check.rows[0];
};

export const getOngoingTrip = async (vehicleId: string, companyId: string) => {
  const check = await pool.query(`
    SELECT t.* FROM "Trip" t
    JOIN "Vehicle" v ON t."vehicleId" = v.id
    WHERE t."vehicleId" = $1 AND v."companyId" = $2 AND t.status = 'ONGOING'
  `, [vehicleId, companyId]);

  if (check.rows.length === 0) {
    throw new Error('Ongoing trip not found');
  }
  return check.rows[0];
};
