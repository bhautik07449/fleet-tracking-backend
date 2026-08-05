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

    // Save live coordinates and status directly to GpsDevice table immediately!
    await client.query(`
      UPDATE "GpsDevice" 
      SET "lastSeen" = NOW(), status = 'ACTIVE', "lastLatitude" = $1, "lastLongitude" = $2, "lastSpeed" = $3, "updatedAt" = NOW() 
      WHERE id = $4
    `, [data.latitude, data.longitude, data.speed || 0, device.id]);

    const vehicleRes = await client.query('SELECT id FROM "Vehicle" WHERE "gpsDeviceId" = $1', [device.id]);
    if (vehicleRes.rows.length === 0) {
      // Even if no vehicle is assigned, save device location and broadcast real-time socket event!
      await client.query('COMMIT');
      try {
        const io = getIO();
        io.to(device.companyId).emit('device-online', { imei: data.imei, status: 'ACTIVE', lastLatitude: data.latitude, lastLongitude: data.longitude, lastSpeed: data.speed, timestamp: new Date().toISOString() });
        io.to(device.companyId).emit('vehicle-location-update', { imei: data.imei, latitude: data.latitude, longitude: data.longitude, speed: data.speed, timestamp: new Date().toISOString() });
      } catch (e) {}
      return { imei: data.imei, companyId: device.companyId, latitude: data.latitude, longitude: data.longitude, speed: data.speed, timestamp: data.timestamp };
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

    // 3. Check overspeed condition (will trigger system alert after COMMIT to avoid blocking transaction)
    const MAX_SPEED = 10;
    const isOverspeed = data.speed > MAX_SPEED;

    // 4. Update Vehicle & Driver Status
    const vStatus = data.speed > 0 ? 'RUNNING' : 'STOPPED';
    await client.query('UPDATE "Vehicle" SET status = $1, "updatedAt" = NOW() WHERE id = $2', [vStatus, vehicle.id]);

    // Check if vehicle has a driver and update their status to ACTIVE when GPS is communicating
    await client.query('UPDATE "Driver" SET "isActive" = TRUE, "updatedAt" = NOW() WHERE id = (SELECT "driverId" FROM "Vehicle" WHERE id = $1)', [vehicle.id]);

    await client.query('COMMIT');

    if (isOverspeed) {
      // Check if an unread overspeed alert was recently sent within the last 15 minutes to prevent email & socket notification spam
      const recentAlert = await pool.query(`SELECT id FROM "Alert" WHERE "vehicleId" = $1 AND type = 'OVERSPEED' AND "isRead" = false AND "createdAt" > NOW() - INTERVAL '15 minutes'`, [vehicle.id]);
      if (recentAlert.rows.length === 0) {
        try {
          const { createSystemAlert } = require('./alert.service');
          await createSystemAlert(vehicle.id, device.companyId, 'OVERSPEED', `Vehicle exceeded speed limit: ${Math.round(data.speed)} km/h (Limit: ${MAX_SPEED} km/h)`);
        } catch (alertErr) {
          console.error('[Alert Engine] Error dispatching overspeed alert:', alertErr);
        }
      }
    }

    const result = {
      vehicleId: vehicle.id,
      companyId: device.companyId,
      imei: data.imei,
      latitude: data.latitude,
      longitude: data.longitude,
      speed: data.speed,
      heading: data.heading,
      status: vStatus,
      timestamp: data.timestamp
    };

    // Broadcast real-time update to connected frontend clients & shared live links
    try {
      const io = getIO();
      io.to(device.companyId).emit('vehicle-location-update', result);
      io.to(device.companyId).emit('device-online', { imei: data.imei, vehicleId: vehicle.id, status: 'ACTIVE', vehicleStatus: vStatus, latitude: data.latitude, longitude: data.longitude, speed: data.speed, timestamp: new Date().toISOString() });
      io.to(`share_${vehicle.id}`).emit('vehicle-location-update', result);
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
    const res = await client.query('UPDATE "GpsDevice" SET "lastSeen" = NOW(), status = $1, "updatedAt" = NOW() WHERE imei = $2 RETURNING id, "companyId", "lastLatitude", "lastLongitude", "lastSpeed"', ['ACTIVE', imei]);
    if (res.rows.length > 0) {
      const device = res.rows[0];
      // If the mapped vehicle was OFFLINE, change its status to STOPPED and awaken assigned driver
      const vRes = await client.query(`UPDATE "Vehicle" SET status = CASE WHEN status = 'OFFLINE' THEN 'STOPPED' ELSE status END, "updatedAt" = NOW() WHERE "gpsDeviceId" = $1 RETURNING id, status`, [device.id]);
      await client.query(`UPDATE "Driver" SET "isActive" = TRUE, "updatedAt" = NOW() WHERE id = (SELECT "driverId" FROM "Vehicle" WHERE "gpsDeviceId" = $1)`, [device.id]);
      try {
        const io = getIO();
        const vehicleId = vRes.rows.length > 0 ? vRes.rows[0].id : undefined;
        const vehicleStatus = vRes.rows.length > 0 ? vRes.rows[0].status : 'STOPPED';

        io.to(device.companyId).emit('device-online', { 
          imei, 
          vehicleId, 
          status: 'ACTIVE', 
          vehicleStatus, 
          latitude: device.lastLatitude, 
          longitude: device.lastLongitude, 
          speed: device.lastSpeed || 0, 
          timestamp: new Date().toISOString() 
        });
        if (vehicleId) {
          io.to(device.companyId).emit('vehicle-location-update', { 
            vehicleId, 
            imei, 
            latitude: device.lastLatitude, 
            longitude: device.lastLongitude, 
            speed: device.lastSpeed || 0, 
            status: vehicleStatus, 
            timestamp: new Date().toISOString() 
          });
        }
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
      
      // Also set any mapped Vehicle to OFFLINE and assigned Driver to INACTIVE
      await client.query(`UPDATE "Driver" SET "isActive" = FALSE, "updatedAt" = NOW() WHERE id = (SELECT "driverId" FROM "Vehicle" WHERE "gpsDeviceId" = $1)`, [device.id]);
      const vRes = await client.query('UPDATE "Vehicle" SET status = $1, "updatedAt" = NOW() WHERE "gpsDeviceId" = $2 RETURNING id, "vehicleNumber"', ['OFFLINE', device.id]);
      
      await client.query('COMMIT');

      // Broadcast instant offline events to Frontend
      try {
        const io = getIO();
        io.to(device.companyId).emit('device-offline', { imei, status: 'INACTIVE', timestamp: new Date().toISOString() });
        if (vRes.rows.length > 0) {
          io.to(device.companyId).emit('vehicle-offline', { vehicleId: vRes.rows[0].id, imei, status: 'OFFLINE', timestamp: new Date().toISOString() });
        }
      } catch (e) {}

      // Dispatch GPS OFF & Vehicle Stopped system alert and email notification
      if (vRes.rows.length > 0) {
        const veh = vRes.rows[0];
        try {
          const recentAlert = await pool.query(
            `SELECT id FROM "Alert" WHERE "vehicleId" = $1 AND type = 'OFFLINE' AND "isRead" = false AND "createdAt" > NOW() - INTERVAL '30 minutes'`,
            [veh.id]
          );
          if (recentAlert.rows.length === 0) {
            const { createSystemAlert } = require('./alert.service');
            await createSystemAlert(
              veh.id,
              device.companyId,
              'OFFLINE',
              `GPS is OFF: Your vehicle (${veh.vehicleNumber || 'ID ' + veh.id}) is currently stopped / disconnected.`
            );
          }
        } catch (alertErr) {
          console.error('[Location Service] Failed to dispatch offline alert:', alertErr);
        }
      }

      console.log(`[TCP] Marked IMEI ${imei}, associated vehicle and driver as OFFLINE.`);
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
