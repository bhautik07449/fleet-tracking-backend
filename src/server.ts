import http from 'http';
import app from './app';
import { initSocketServer } from './socket';
import { startTcpServer } from './tcp/server';
import { startOfflineChecker } from './jobs/offlineChecker';
import pool from './db';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Initialize Socket.IO Server
initSocketServer(server);

// Run automatic schema migration for new columns, tables, and enums on startup
const runStartupMigrations = async () => {
  console.log('[DB] Running automatic database migrations...');
  try {
    // 1. GpsDevice Columns
    await pool.query(`
      ALTER TABLE "GpsDevice" 
      ADD COLUMN IF NOT EXISTS "lastLatitude" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "lastLongitude" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "lastSpeed" DOUBLE PRECISION;
    `);

    // 2. Vehicle Columns
    await pool.query(`
      ALTER TABLE "Vehicle" 
      ADD COLUMN IF NOT EXISTS "maxSpeed" DOUBLE PRECISION DEFAULT 80,
      ADD COLUMN IF NOT EXISTS "engineStatus" TEXT DEFAULT 'ON',
      ADD COLUMN IF NOT EXISTS "lastLatitude" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "lastLongitude" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "lastSpeed" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "lastSeen" TIMESTAMP;
    `);

    // 3. Driver Columns
    await pool.query(`
      ALTER TABLE "Driver" 
      ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    // 4. VehicleStatus Enum Values
    const newStatuses = ["Moving", "Stopped", "Idle", "Inactive", "No data", "Overspeed"];
    for (const status of newStatuses) {
      try {
        await pool.query(`ALTER TYPE "VehicleStatus" ADD VALUE '${status}'`);
        console.log(`[DB] Added enum value: ${status}`);
      } catch (err: any) {
        if (!err.message.includes('already exists')) {
          console.error(`[DB] Failed to add enum value ${status}:`, err.message);
        }
      }
    }

    // 5. Migrate old status strings
    try {
      await pool.query(`UPDATE "Vehicle" SET status = 'Inactive' WHERE status = 'OFFLINE'`);
      await pool.query(`UPDATE "Vehicle" SET status = 'Moving'   WHERE status = 'RUNNING'`);
      await pool.query(`UPDATE "Vehicle" SET status = 'Stopped'  WHERE status = 'STOPPED'`);
      await pool.query(`UPDATE "Vehicle" SET status = 'Idle'     WHERE status = 'IDLE'`);
      await pool.query(`UPDATE "Vehicle" SET status = 'Moving'   WHERE status = 'TOWING'`);
      console.log('[DB] Successfully migrated existing vehicle status strings.');
    } catch (err: any) {
      console.error('[DB] Status values migration notice:', err.message);
    }

    // 6. SharedLink & MaintenanceReminder Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "SharedLink" (
        "id" TEXT PRIMARY KEY,
        "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
        "vehicleId" TEXT NOT NULL REFERENCES "Vehicle"("id") ON DELETE CASCADE,
        "token" TEXT UNIQUE NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "MaintenanceReminder" (
        "id" TEXT PRIMARY KEY,
        "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
        "vehicleId" TEXT NOT NULL REFERENCES "Vehicle"("id") ON DELETE CASCADE,
        "title" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "dueDate" DATE,
        "dueDistance" DOUBLE PRECISION,
        "currentDistance" DOUBLE PRECISION DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "notes" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log('[DB] Automatic startup migrations successfully verified.');
  } catch (error: any) {
    console.error('[DB] Critical error running startup migrations:', error.message);
  }
};

runStartupMigrations();

server.listen(PORT, () => {
  console.log(`HTTP Server is running on port ${PORT}`);
});

// Start the TCP Server for GPS devices
startTcpServer();

// Start the Background Job for offline detection
startOfflineChecker();

// Global Fallback Error Handlers to prevent complete server crashes
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});
