import pool from '../db';
import crypto from 'crypto';
import { getIO } from '../socket/index';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export const processLocationUpdate = async (data: any) => {
  // Discard null island coordinates
  if (!data.latitude || !data.longitude || (data.latitude === 0 && data.longitude === 0)) {
    return null;
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Find Vehicle by IMEI
    const deviceRes = await client.query('SELECT id, "companyId" FROM "GpsDevice" WHERE imei = $1', [data.imei]);
    if (deviceRes.rows.length === 0) {
      throw new Error(`Device with IMEI ${data.imei} not found`);
    }
    const device = deviceRes.rows[0];

    const vehicleRes = await client.query('SELECT id, "maxSpeed", "lastLatitude", "lastLongitude", "lastSeen", status FROM "Vehicle" WHERE "gpsDeviceId" = $1', [device.id]);
    
    // --- Anomaly / Spiderweb Detection ---
    if (vehicleRes.rows.length > 0) {
      const v = vehicleRes.rows[0];
      if (v.lastLatitude && v.lastLongitude && v.lastSeen) {
        const distKm = getDistance(v.lastLatitude, v.lastLongitude, data.latitude, data.longitude);
        // Minimum assumed time gap of 5 seconds (0.00138 hr) to prevent absurd speed spikes on rapid consecutive packets
        const timeElapsedHours = Math.max(0.00138, Math.abs(new Date(data.timestamp).getTime() - new Date(v.lastSeen).getTime()) / (1000 * 60 * 60));
        const impliedSpeed = distKm / timeElapsedHours;

        // Reject if implied speed > 200 km/h AND distance is notable (> 0.2 km to allow slight GPS drift/jitter)
        if (impliedSpeed > 200 && distKm > 0.2) {
          console.warn(`[TCP] Blocked Anomalous GPS jump for IMEI ${data.imei}: ${distKm.toFixed(2)}km in ${timeElapsedHours.toFixed(4)}hr (Implied ${impliedSpeed.toFixed(0)}km/h).`);
          await client.query('ROLLBACK');
          return null;
        }

        // --- Static Drift (Parking) Filter ---
        // If device reports very low speed (< 5 km/h) within a 40 meter radius,
        // it's likely just GPS drift while parked. Snap to last known position to prevent wandering.
        if ((data.speed || 0) < 5 && distKm < 0.04) {
          data.latitude = v.lastLatitude;
          data.longitude = v.lastLongitude;
          data.speed = 0;
        }
      }
    }

    // Save live coordinates and status directly to GpsDevice table immediately!
    await client.query(`
      UPDATE "GpsDevice" 
      SET "lastSeen" = NOW(), status = 'ACTIVE', "lastLatitude" = $1, "lastLongitude" = $2, "lastSpeed" = $3, "updatedAt" = NOW() 
      WHERE id = $4
    `, [data.latitude, data.longitude, data.speed || 0, device.id]);
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

    // 3. Check overspeed condition against customized vehicle maxSpeed (default 80 km/h)
    const MAX_SPEED = Number(vehicle.maxSpeed || 80);
    const isOverspeed = (data.speed || 0) > MAX_SPEED;

    // 4. Update Vehicle & Driver Status and save exact live GPS coordinates directly onto Vehicle table!
    let vStatus = 'Stopped';
    const speed = data.speed || 0;
    
    let isIgnitionOn = data.ignitionStatus;
    if (isIgnitionOn === undefined) {
      // Inherit ignition state from previous known status in database
      const currentStatus = vehicle.status;
      isIgnitionOn = currentStatus === 'Moving' || currentStatus === 'Idle' || currentStatus === 'Overspeed';
    }

    if (isOverspeed) {
      vStatus = 'Overspeed';
    } else if (isIgnitionOn) {
      vStatus = speed > 0 ? 'Moving' : 'Idle';
    } else {
      vStatus = speed > 0 ? 'Moving' : 'Stopped'; // Even if ignition is off, if speed > 0 we classify as Moving (since Towing is removed)
    }
    await client.query(`
      UPDATE "Vehicle" 
      SET status = $1, "lastLatitude" = $2, "lastLongitude" = $3, "lastSpeed" = $4, "lastSeen" = NOW(), "updatedAt" = NOW() 
      WHERE id = $5
    `, [vStatus, data.latitude, data.longitude, data.speed || 0, vehicle.id]);

    // Check if vehicle has a driver and update their status to ACTIVE when GPS is communicating
    await client.query('UPDATE "Driver" SET "isActive" = TRUE, "updatedAt" = NOW() WHERE id = (SELECT "driverId" FROM "Vehicle" WHERE id = $1)', [vehicle.id]);

    await client.query('COMMIT');

    if (isOverspeed) {
      // Wrap in a safe catch block so this side-effect doesn't break the already-committed transaction rollback handler
      try {
        const recentAlert = await pool.query(`SELECT id FROM "Alert" WHERE "vehicleId" = $1 AND type = 'OVERSPEED' AND "isRead" = false AND "createdAt" > NOW() - INTERVAL '15 minutes'`, [vehicle.id]);
        if (recentAlert.rows.length === 0) {
          try {
            const { createSystemAlert } = require('./alert.service');
            await createSystemAlert(
              vehicle.id, 
              device.companyId, 
              'OVERSPEED', 
              `OVERSPEED ALERT: Vehicle exceeded maximum limit of ${MAX_SPEED} km/h! Currently driving at ${Math.round(data.speed || 0)} km/h.`
            );
          } catch (alertErr) {
            console.error('[Alert Engine] Error dispatching overspeed alert:', alertErr);
          }
        }
      } catch (poolErr) {
        console.error('[Alert Engine] DB Error while checking recent overspeed alerts:', poolErr);
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
      ignitionStatus: isIgnitionOn,  //acc status on off
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
      // If the mapped vehicle was Inactive, change its status to Stopped and awaken assigned driver
      const vRes = await client.query(`UPDATE "Vehicle" SET status = CASE WHEN status = 'Inactive' THEN 'Stopped' ELSE status END, "updatedAt" = NOW() WHERE "gpsDeviceId" = $1 RETURNING id, status`, [device.id]);
      await client.query(`UPDATE "Driver" SET "isActive" = TRUE, "updatedAt" = NOW() WHERE id = (SELECT "driverId" FROM "Vehicle" WHERE "gpsDeviceId" = $1)`, [device.id]);
      try {
        const io = getIO();
        const vehicleId = vRes.rows.length > 0 ? vRes.rows[0].id : undefined;
        const vehicleStatus = vRes.rows.length > 0 ? vRes.rows[0].status : 'Stopped';

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
