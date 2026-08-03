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

// Run automatic schema migration for GpsDevice location columns on startup
pool.query(`
  ALTER TABLE "GpsDevice" 
  ADD COLUMN IF NOT EXISTS "lastLatitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastLongitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastSpeed" DOUBLE PRECISION;
`).then(() => console.log('[DB] Verified GpsDevice location schema.'))
  .catch((e) => console.error('[DB] Schema verification notice:', e.message));

server.listen(PORT, () => {
  console.log(`HTTP Server is running on port ${PORT}`);
});

// Start the TCP Server for GPS devices
startTcpServer();

// Start the Background Job for offline detection
startOfflineChecker();
