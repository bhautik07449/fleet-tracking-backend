import pool from '../db';
import crypto from 'crypto';
import { getIO } from '../socket/index';

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

    // 4. Update Device, Vehicle & Driver Status
    await client.query('UPDATE "GpsDevice" SET "lastSeen" = NOW(), status = $1, "updatedAt" = NOW() WHERE id = $2', ['ACTIVE', device.id]);
    
    const vStatus = data.speed > 0 ? 'RUNNING' : 'STOPPED';
    await client.query('UPDATE "Vehicle" SET status = $1, "updatedAt" = NOW() WHERE id = $2', [vStatus, vehicle.id]);

    // Check if vehicle has a driver and update their status
    const driverRes = await client.query('SELECT "driverId" FROM "Vehicle" WHERE id = $1', [vehicle.id]);
    if (driverRes.rows.length > 0 && driverRes.rows[0].driverId) {
      const driverId = driverRes.rows[0].driverId;
      const isDriverActive = data.speed > 0;
      await client.query('UPDATE "Driver" SET "isActive" = $1, "updatedAt" = NOW() WHERE id = $2', [isDriverActive, driverId]);
    }

    await client.query('COMMIT');

    const result = {
      vehicleId: vehicle.id,
      companyId: device.companyId,
      latitude: data.latitude,
      longitude: data.longitude,
      speed: data.speed,
      heading: data.heading,
      timestamp: data.timestamp
    };

    // Broadcast real-time update to connected frontend clients
    try {
      const io = getIO();
      io.to(device.companyId).emit('vehicle-location-update', result);
      io.to(device.companyId).emit('device-online', { imei: data.imei, status: 'ACTIVE', timestamp: new Date().toISOString() });
    } catch (e) {
      // Socket might not be ready yet; safe to ignore
    }

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const touchDeviceLastSeen = async (imei: string) => {
  const client = await pool.connect();
  try {
    const res = await client.query('UPDATE "GpsDevice" SET "lastSeen" = NOW(), status = $1, "updatedAt" = NOW() WHERE imei = $2 RETURNING id, "companyId"', ['ACTIVE', imei]);
    if (res.rows.length > 0) {
      const device = res.rows[0];
      // If the mapped vehicle was OFFLINE, change its status to STOPPED (since tracker is communicating again!)
      await client.query(`UPDATE "Vehicle" SET status = 'STOPPED', "updatedAt" = NOW() WHERE "gpsDeviceId" = $1 AND status = 'OFFLINE'`, [device.id]);
      try {
        const io = getIO();
        io.to(device.companyId).emit('device-online', { imei, status: 'ACTIVE', timestamp: new Date().toISOString() });
        io.to(device.companyId).emit('vehicle-location-update', { imei, timestamp: new Date().toISOString() });
      } catch (e) {}
    }
  } catch (error) {
    console.error(`[DB] Failed to update lastSeen for IMEI ${imei}:`, error);
  } finally {
    client.release();
  }
};

export const markDeviceOffline = async (imei: string) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Mark GPS Device as INACTIVE (Offline)
    const res = await client.query('UPDATE "GpsDevice" SET status = $1, "updatedAt" = NOW() WHERE imei = $2 RETURNING id, "companyId"', ['INACTIVE', imei]);
    
    if (res.rows.length > 0) {
      const device = res.rows[0];
      
      // Also set any mapped Vehicle to OFFLINE
      const vRes = await client.query('UPDATE "Vehicle" SET status = $1, "updatedAt" = NOW() WHERE "gpsDeviceId" = $2 RETURNING id', ['OFFLINE', device.id]);
      
      await client.query('COMMIT');

      // Broadcast instant offline events to Frontend
      try {
        const io = getIO();
        io.to(device.companyId).emit('device-offline', { imei, status: 'INACTIVE', timestamp: new Date().toISOString() });
        if (vRes.rows.length > 0) {
          io.to(device.companyId).emit('vehicle-offline', { vehicleId: vRes.rows[0].id, status: 'OFFLINE', timestamp: new Date().toISOString() });
        }
      } catch (e) {}
      console.log(`[TCP] Marked IMEI ${imei} and associated vehicle as OFFLINE.`);
    } else {
      await client.query('ROLLBACK');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[DB] Failed to set device offline for IMEI ${imei}:`, error);
  } finally {
    client.release();
  }
};
