import http from 'http';
import app from './app';
import { initSocketServer } from './socket';
import { startTcpServer } from './tcp/server';
import { startOfflineChecker } from './jobs/offlineChecker';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Initialize Socket.IO Server
initSocketServer(server);

server.listen(PORT, () => {
  console.log(`HTTP Server is running on port ${PORT}`);
});

// Start the TCP Server for GPS devices
startTcpServer();

// Start the Background Job for offline detection
startOfflineChecker();
