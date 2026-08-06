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

// Run automatic schema migration for new columns & tables on startup
pool.query(`
  ALTER TABLE "GpsDevice" 
  ADD COLUMN IF NOT EXISTS "lastLatitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastLongitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastSpeed" DOUBLE PRECISION;

  ALTER TABLE "Vehicle" 
  ADD COLUMN IF NOT EXISTS "maxSpeed" DOUBLE PRECISION DEFAULT 80,
  ADD COLUMN IF NOT EXISTS "lastLatitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastLongitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastSpeed" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastSeen" TIMESTAMP;

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
`).then(() => console.log('[DB] Verified database schema & tables (SharedLink, MaintenanceReminder).'))
  .catch((e) => console.error('[DB] Schema verification notice:', e.message));

server.listen(PORT, () => {
  console.log(`HTTP Server is running on port ${PORT}`);
});

// Start the TCP Server for GPS devices
startTcpServer();

// Start the Background Job for offline detection
startOfflineChecker();
