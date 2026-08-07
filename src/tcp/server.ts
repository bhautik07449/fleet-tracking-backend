import net from 'net';
import { parseRawData, ParsedGPSData } from '../gps/parser';
import { processLocationUpdate, touchDeviceLastSeen } from '../services/location.service';
const Gt06 = require('gt06');

const TCP_PORT = process.env.TCP_PORT ? parseInt(process.env.TCP_PORT) : 4000;

// Map to store Socket instance -> IMEI
const connectedDevices = new Map<net.Socket, string>();

export const startTcpServer = () => {
  const server = net.createServer((socket) => {
    console.log(`[TCP] GPS Device connected: ${socket.remoteAddress}:${socket.remotePort}`);
    const parser = new Gt06();

    socket.on('data', async (rawData) => {
      const data: Buffer = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData);
      // Check if it is a binary GT06/PT06 packet (starts with 0x78 0x78 or 0x79 0x79)
      const isBinaryGps = data.length >= 2 && ((data[0] === 0x78 && data[1] === 0x78) || (data[0] === 0x79 && data[1] === 0x79));

      if (isBinaryGps) {
        // Try parsing standard packets (0x01, 0x12, 0x13, 0x16) with the gt06 library
        try {
          if (data[0] === 0x78 && data[1] === 0x78) {
            parser.parse(data);
          } else {
            // 0x7979 are usually info/ICCID reporting packets from PT06
            const imei = connectedDevices.get(socket);
            if (imei) touchDeviceLastSeen(imei);
            console.log(`[TCP] PT06 Extended Info Packet received (${data.length} bytes)`);
            return;
          }
        } catch (e: any) {
          // Handle extended PT06 packets (like 0x24 / decimal 36 or 0x26 / decimal 38)
          const imei = connectedDevices.get(socket);
          if (imei) touchDeviceLastSeen(imei);

          if (e.event && (e.event.number === 36 || e.event.number === 38 || e.event.number === 34)) {
            console.log(`[TCP] PT06 LBS/Extended Location packet received (Protocol: 0x${e.event.number.toString(16)})`);
            
            // Attempt manual coordinate extraction from 0x24 / 0x26 extended packets
            try {
              if (data.length >= 22 && imei) {
                const rawLat = data.readUInt32BE(11);
                const rawLon = data.readUInt32BE(15);
                const speed = data.readUInt8(19);
                const lat = rawLat / 1800000.0;
                const lon = rawLon / 1800000.0;

                  let extractedIgnition: boolean | undefined = undefined;
                  
                  // For 0x22 (decimal 34) Location+Status packet, byte 30 is Terminal Information
                  if (data.length >= 31 && e.event.number === 34) {
                    extractedIgnition = Boolean(data[30] & 0x02);
                  }

                  if (lat > 1.0 && lon > 1.0 && lat < 90 && lon < 180) {
                    await processLocationUpdate({
                      imei,
                      latitude: lat,
                      longitude: lon,
                      speed: speed || 0,
                      heading: 0,
                      altitude: 0,
                      ignitionStatus: extractedIgnition,
                      timestamp: new Date()
                    });
                  console.log(`[TCP] Extracted Extended Location for IMEI ${imei}: (${lat.toFixed(5)}, ${lon.toFixed(5)}) - Speed: ${speed} km/h`);
                } else {
                  console.log(`[TCP] Packet contains zero/unfixed coordinates (Device indoors without satellite lock).`);
                }
              }
            } catch (err) {
              console.log(`[TCP] Could not extract manual coordinates from extended packet.`);
            }
          } else {
            console.log(`[TCP] Unhandled GT06 protocol Packet (Header: ${data[3] ? '0x' + data[3].toString(16) : 'unknown'})`);
          }
          return;
        }

        // Send binary ACK back if requested by the tracker
        if (parser.expectsResponse && parser.responseMsg) {
          socket.write(parser.responseMsg);
        }

        for (const msg of parser.msgBuffer) {
          // 0x01: Login Packet
          if (msg.event && msg.event.number === 0x01) {
            const imei = String(msg.imei);
            connectedDevices.set(socket, imei);
            console.log(`[TCP] 🎉 GT06 Device Logged in successfully! IMEI: ${imei}`);
            touchDeviceLastSeen(imei);
          }
          
          // 0x12: Location or 0x16: Alarm
          if (msg.event && (msg.event.number === 0x12 || msg.event.number === 0x16)) {
            const imei = connectedDevices.get(socket);
            if (!imei) {
              console.warn(`[TCP] Location received but device has not completed login.`);
              continue;
            }

            const parsedData: ParsedGPSData = {
              imei: imei,
              latitude: msg.lat,
              longitude: msg.lon,
              speed: msg.speed || 0,
              heading: msg.course || 0,
              altitude: 0,
              ignitionStatus: msg.terminalInfo?.ignition !== undefined ? msg.terminalInfo.ignition : undefined,
              timestamp: msg.fixTime ? new Date(msg.fixTime) : new Date()
            };

            try {
              await processLocationUpdate(parsedData);
              console.log(`[TCP] Location updated for IMEI ${imei}: (${msg.lat}, ${msg.lon}) - Speed: ${msg.speed} km/h`);
            } catch (error: any) {
              console.error(`[TCP] Error writing location to DB: ${error.message}`);
            }
          }
        }
        
        parser.clearMsgBuffer();
        return;
      }

      // If not a binary packet, check if it's an internet scanner / HTTP bot (common on open VPS ports)
      if (data.toString().startsWith('GET') || data.toString().startsWith('POST')) {
        socket.end();
        return;
      }

      // Fallback to text/JSON parser (for simulate-gps.js testing script)
      try {
        const parsedData = parseRawData(data as Buffer);
        if (parsedData) {
          await processLocationUpdate(parsedData);
          socket.write('ACK\n');
        } else {
          console.log(`[TCP] Unrecognized text data from ${socket.remoteAddress}:`, data.toString('hex'));
        }
      } catch (error: any) {
        console.error(`[TCP] Error processing text data: ${error.message}`);
        socket.write('ERROR\n');
      }
    });

    const handleDisconnect = () => {
      const imei = connectedDevices.get(socket);
      if (imei) {
        console.log(`[TCP] GPS Device disconnected (IMEI ${imei}). Will go OFFLINE if no reconnect within 2 mins.`);
      }
      connectedDevices.delete(socket);
    };

    socket.on('end', handleDisconnect);
    socket.on('close', handleDisconnect);
    socket.on('error', (err) => {
      console.error(`[TCP] Socket error:`, err.message);
      handleDisconnect();
    });
  });

  server.listen(TCP_PORT, () => {
    console.log(`TCP GPS Server is listening on port ${TCP_PORT}`);
  });

  server.on('error', (err) => {
    console.error(`[TCP] Server error:`, err.message);
  });
};
