import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';

let io: Server;

export const initSocketServer = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: '*',
    },
  });

  // Socket Authentication & Share Token Middleware
  io.use(async (socket: Socket, next) => {
    const shareToken = socket.handshake.auth.shareToken || socket.handshake.query?.shareToken;
    if (shareToken) {
      try {
        const pool = require('../db').default;
        const res = await pool.query('SELECT "vehicleId", "expiresAt" FROM "SharedLink" WHERE token = $1', [shareToken]);
        if (res.rows.length > 0 && new Date(res.rows[0].expiresAt) > new Date()) {
          (socket as any).shareRoom = `share_${res.rows[0].vehicleId}`;
          return next();
        }
        return next(new Error('Authentication error: Invalid or expired tracking share link'));
      } catch(e) {
        return next(new Error('Authentication error checking share token'));
      }
    }

    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication error: Token not provided'));
    }

    const decoded: any = verifyAccessToken(token);
    if (!decoded) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }

    // Attach decoded user info to the socket instance
    (socket as any).user = decoded;
    next();
  });

  io.on('connection', (socket: Socket) => {
    if ((socket as any).shareRoom) {
      const room = (socket as any).shareRoom;
      socket.join(room);
      console.log(`[Socket.IO] Client connected to share room: ${socket.id} -> ${room}`);
      return;
    }

    const user = (socket as any).user;
    if (user) {
      console.log(`[Socket.IO] Client connected: ${socket.id} (User: ${user.userId})`);
      // Users join a room specifically for their company
      if (user.companyId) {
        socket.join(user.companyId);
        console.log(`[Socket.IO] Socket ${socket.id} joined room: ${user.companyId}`);
      }
    }

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized!');
  }
  return io;
};
