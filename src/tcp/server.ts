import net from 'net';
import { parseRawData, ParsedGPSData } from '../gps/parser';
import { processLocationUpdate } from '../services/location.service';
const Gt06 = require('gt06');

const TCP_PORT = process.env.TCP_PORT ? parseInt(process.env.TCP_PORT) : 4000;

// Map to store Socket instance -> IMEI
const connectedDevices = new Map<net.Socket, string>();

export const startTcpServer = () => {
  const server = net.createServer((socket) => {
    console.log(`[TCP] GPS Device connected: ${socket.remoteAddress}:${socket.remotePort}`);
    const parser = new Gt06();

    socket.on('data', async (data) => {
      let isGt06 = false;

      // First, try parsing with GT06
      try {
        if (data.length >= 2 && data[0] === 0x78 && data[1] === 0x78) {
          parser.parse(data);
          isGt06 = true;
        }
      } catch (e) {
        // Not a valid GT06 packet or parse error
        console.error(`[TCP] GT06 Parse Error:`, e);
      }

      if (isGt06) {
        // Send ACK back if requested
        if (parser.expectsResponse && parser.responseMsg) {
          socket.write(parser.responseMsg);
        }

        for (const msg of parser.msgBuffer) {
          // 0x01: Login
          if (msg.event && msg.event.number === 0x01) {
            const imei = String(msg.imei);
            connectedDevices.set(socket, imei);
            console.log(`[TCP] GT06 Device Logged in with IMEI: ${imei}`);
          }
          
          // 0x12: Location or 0x16: Alarm (has location)
          if (msg.event && (msg.event.number === 0x12 || msg.event.number === 0x16)) {
            const imei = connectedDevices.get(socket);
            if (!imei) {
              console.warn(`[TCP] Location received but device not logged in.`);
              continue;
            }

            const parsedData: ParsedGPSData = {
              imei: imei,
              latitude: msg.lat,
              longitude: msg.lon,
              speed: msg.speed,
              heading: msg.course,
              altitude: 0, // Not provided by gt06 parser natively
              ignitionStatus: false, // Defaulting to false, handled by 0x13 in advanced use cases
              timestamp: msg.fixTime ? new Date(msg.fixTime) : new Date()
            };

            try {
              await processLocationUpdate(parsedData);
            } catch (error: any) {
              console.error(`[TCP] Error processing GT06 location update: ${error.message}`);
            }
          }
        }
        
        parser.clearMsgBuffer();
        return;
      }

      // Fallback to text/JSON parser (for simulate-gps.js)
      try {
        const parsedData = parseRawData(data as Buffer);
        if (parsedData) {
          await processLocationUpdate(parsedData);
        } else {
          console.log(`[TCP] Unrecognized data from ${socket.remoteAddress}:`, data.toString('hex'));
        }
        
        // Acknowledge receipt
        socket.write('ACK\n');
      } catch (error: any) {
        console.error(`[TCP] Error processing data: ${error.message}`);
        require('fs').appendFileSync('tcp-error.log', error.stack + '\n\n');
        socket.write('ERROR\n');
      }
    });

    socket.on('end', () => {
      connectedDevices.delete(socket);
      console.log(`[TCP] GPS Device disconnected: ${socket.remoteAddress}`);
    });

    socket.on('error', (err) => {
      connectedDevices.delete(socket);
      console.error(`[TCP] Socket error:`, err.message);
    });
  });

  server.listen(TCP_PORT, () => {
    console.log(`TCP GPS Server is listening on port ${TCP_PORT}`);
  });

  server.on('error', (err) => {
    console.error(`[TCP] Server error:`, err.message);
  });
};
