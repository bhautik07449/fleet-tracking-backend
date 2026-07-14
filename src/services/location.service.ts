import pool from '../db';
import crypto from 'crypto';

export const processLocationUpdate = async (data: any) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Find Vehicle by IMEI
    const deviceRes = await client.query('SELECT id, "companyId" FROM "GpsDevice" WHERE imei = $1', [data.imei]);
    if (deviceRes.rows.length === 0) {
      throw new Error(`Device with IMEI ${data.imei} not found`);
    }
    const device = deviceRes.rows[0];

    const vehicleRes = await client.query('SELECT id FROM "Vehicle" WHERE "gpsDeviceId" = $1', [device.id]);
    if (vehicleRes.rows.length === 0) {
      throw new Error(`No vehicle mapped to device IMEI ${data.imei}`);
    }
    const vehicle = vehicleRes.rows[0];

    // 2. Insert Location Record
    const locationId = crypto.randomUUID();
    await client.query(`
      INSERT INTO "VehicleLocation" (id, "vehicleId", latitude, longitude, speed, heading, altitude, battery, "ignitionStatus", timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      locationId, vehicle.id, data.latitude, data.longitude, 
      data.speed || 0, data.heading || 0, data.altitude || 0, 
      data.battery || null, data.ignitionStatus || false, new Date(data.timestamp)
    ]);

    // 3. Simple overspeed logic
    const MAX_SPEED = 80;
    if (data.speed > MAX_SPEED) {
      const alertId = crypto.randomUUID();
      await client.query(`
        INSERT INTO "Alert" (id, "vehicleId", type, message)
        VALUES ($1, $2, $3, $4)
      `, [alertId, vehicle.id, 'OVERSPEED', `Vehicle exceeded speed limit: ${data.speed} km/h`]);
      // Would emit socket event for alert here in production
    }

    // 4. Update Device & Vehicle Status
    await client.query('UPDATE "GpsDevice" SET "lastSeen" = NOW(), status = $1, "updatedAt" = NOW() WHERE id = $2', ['ACTIVE', device.id]);
    
    const vStatus = data.speed > 0 ? 'RUNNING' : 'STOPPED';
    await client.query('UPDATE "Vehicle" SET status = $1, "updatedAt" = NOW() WHERE id = $2', [vStatus, vehicle.id]);

    await client.query('COMMIT');

    return {
      vehicleId: vehicle.id,
      companyId: device.companyId,
      latitude: data.latitude,
      longitude: data.longitude,
      speed: data.speed,
      timestamp: data.timestamp
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
