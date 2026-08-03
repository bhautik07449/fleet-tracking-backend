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
        RETURNING v.id as "vehicleId", v."companyId", v."driverId"
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
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[JOBS] Error in Offline Checker:', error);
    } finally {
      client.release();
    }
  }, 30000); // 30 seconds
};
