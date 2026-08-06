import pool from '../db';
import { getIO } from '../socket/index';

export const startOfflineChecker = () => {
  console.log('[JOBS] Starting Offline Checker Job...');
  
  // Run every 30 seconds (30000 ms)
  setInterval(async () => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Find and update all GPS Devices that haven't pinged in 2 minutes
      const deviceQuery = `
        UPDATE "GpsDevice" 
        SET status = 'INACTIVE', "updatedAt" = NOW() 
        WHERE status = 'ACTIVE' 
        AND ("lastSeen" < NOW() - INTERVAL '2 minutes' OR "lastSeen" IS NULL)
        RETURNING imei, "companyId", id
      `;
      const devRes = await client.query(deviceQuery);

      if (devRes.rows.length > 0) {
        console.log(`[JOBS] Marked ${devRes.rows.length} unresponsive GPS devices as INACTIVE/OFFLINE.`);
        for (const dev of devRes.rows) {
          try {
            const io = getIO();
            io.to(dev.companyId).emit('device-offline', {
              imei: dev.imei,
              status: 'INACTIVE',
              timestamp: new Date().toISOString()
            });
          } catch (e) {}
        }
      }

      // 2. Find and update all Vehicles whose mapped GpsDevice is INACTIVE or missing
      const vehicleQuery = `
        UPDATE "Vehicle" v
        SET status = 'OFFLINE', "updatedAt" = NOW()
        WHERE v.status != 'OFFLINE'
        AND (
          v."gpsDeviceId" IS NULL OR 
          v."gpsDeviceId" IN (SELECT id FROM "GpsDevice" WHERE status = 'INACTIVE')
        )
        RETURNING v.id as "vehicleId", v."companyId", v."driverId", v."vehicleNumber"
      `;
      const vehRes = await client.query(vehicleQuery);

      if (vehRes.rows.length > 0) {
        console.log(`[JOBS] Marked ${vehRes.rows.length} vehicles as OFFLINE.`);
        for (const row of vehRes.rows) {
          if (row.driverId) {
            await client.query(`UPDATE "Driver" SET "isActive" = FALSE, "updatedAt" = NOW() WHERE id = $1`, [row.driverId]);
          }
          try {
            const io = getIO();
            io.to(row.companyId).emit('vehicle-offline', {
              vehicleId: row.vehicleId,
              status: 'OFFLINE',
              timestamp: new Date().toISOString()
            });
          } catch (e) {}
        }
      }
      
      await client.query('COMMIT');

      // 3. Dispatch automated Email & UI alerts for newly OFFLINE / STOPPED vehicles after commit
      if (vehRes.rows.length > 0) {
        for (const row of vehRes.rows) {
          try {
            const recentAlert = await pool.query(
              `SELECT id FROM "Alert" WHERE "vehicleId" = $1 AND type = 'OFFLINE' AND "isRead" = false AND "createdAt" > NOW() - INTERVAL '30 minutes'`,
              [row.vehicleId]
            );
            if (recentAlert.rows.length === 0) {
              const { createSystemAlert } = require('../services/alert.service');
              await createSystemAlert(
                row.vehicleId,
                row.companyId,
                'OFFLINE',
                `DEVICE INACTIVE / OFFLINE: GPS device on vehicle ${row.vehicleNumber || 'ID ' + row.vehicleId} is not functioning or stopped sending signals.`
              );
            }
          } catch (alertErr) {
            console.error('[Offline Checker] Failed to dispatch offline alert:', alertErr);
          }
        }
      }

      // 4. Automatically dispatch Maintenance & Compliance Reminder Alerts when due
      try {
        const dueReminders = await pool.query(`
          SELECT m.*, v."vehicleNumber" 
          FROM "MaintenanceReminder" m
          JOIN "Vehicle" v ON m."vehicleId" = v.id
          WHERE m.status = 'ACTIVE' 
          AND (
            (m."dueDate" IS NOT NULL AND m."dueDate" <= NOW() + INTERVAL '7 days')
            OR 
            (m."dueDistance" IS NOT NULL AND m."currentDistance" >= m."dueDistance" - 500)
          )
        `);

        if (dueReminders.rows.length > 0) {
          for (const rem of dueReminders.rows) {
            const recentRemAlert = await pool.query(
              `SELECT id FROM "Alert" WHERE "vehicleId" = $1 AND type = 'MAINTENANCE' AND "isRead" = false AND "createdAt" > NOW() - INTERVAL '24 hours'`,
              [rem.vehicleId]
            );
            if (recentRemAlert.rows.length === 0) {
              const { createSystemAlert } = require('../services/alert.service');
              await createSystemAlert(
                rem.vehicleId,
                rem.companyId,
                'MAINTENANCE',
                `MAINTENANCE & COMPLIANCE ALERT: ${rem.title} (${rem.category}) for vehicle ${rem.vehicleNumber} is due soon or overdue!`
              );
            }
          }
        }
      } catch (remErr) {
        // Table might be initializing or empty
      }
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[JOBS] Error in Offline Checker:', error);
    } finally {
      client.release();
    }
  }, 30000); // 30 seconds
};
