import pool from '../db';
import { getIO } from '../socket/index';

export const startOfflineChecker = () => {
  console.log('[JOBS] Starting Offline Checker Job...');
  
  // Run every 60 seconds (60000 ms)
  setInterval(async () => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Find all vehicles that are currently RUNNING or STOPPED, 
      // but their GPS device hasn't been seen in over 5 minutes.
      const query = `
        SELECT v.id as "vehicleId", v."companyId", d.imei 
        FROM "Vehicle" v
        JOIN "GpsDevice" d ON v."gpsDeviceId" = d.id
        WHERE v.status IN ('RUNNING', 'STOPPED') 
        AND (d."lastSeen" < NOW() - INTERVAL '5 minutes' OR d."lastSeen" IS NULL)
      `;
      
      const { rows } = await client.query(query);
      
      if (rows.length > 0) {
        console.log(`[JOBS] Found ${rows.length} unresponsive vehicles. Marking as OFFLINE.`);
        
        for (const row of rows) {
          // Update Vehicle Status
          await client.query(`UPDATE "Vehicle" SET status = 'OFFLINE', "updatedAt" = NOW() WHERE id = $1`, [row.vehicleId]);
          
          // Update GPS Device Status to INACTIVE
          await client.query(`UPDATE "GpsDevice" SET status = 'INACTIVE', "updatedAt" = NOW() WHERE imei = $1`, [row.imei]);
          
          // Optionally update Driver Status
          await client.query(`
            UPDATE "Driver" SET "isActive" = FALSE, "updatedAt" = NOW() 
            WHERE id = (SELECT "driverId" FROM "Vehicle" WHERE id = $1)
          `, [row.vehicleId]);
          
          // Broadcast offline event to frontend
          try {
            const io = getIO();
            io.to(row.companyId).emit('vehicle-offline', {
              vehicleId: row.vehicleId,
              status: 'OFFLINE',
              timestamp: new Date().toISOString()
            });
            io.to(row.companyId).emit('device-offline', {
              imei: row.imei,
              status: 'INACTIVE',
              timestamp: new Date().toISOString()
            });
          } catch (e) {
            // Ignore if socket not ready
          }
        }
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[JOBS] Error in Offline Checker:', error);
    } finally {
      client.release();
    }
  }, 60000); // 1 minute
};
