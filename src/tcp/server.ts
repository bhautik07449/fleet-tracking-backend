import net from 'net';
import { parseRawData } from '../gps/parser';
import { storeLocation } from '../services/location.service';

const TCP_PORT = process.env.TCP_PORT ? parseInt(process.env.TCP_PORT) : 4000;

export const startTcpServer = () => {
  const server = net.createServer((socket) => {
    console.log(`[TCP] GPS Device connected: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on('data', async (data) => {
      const parsedData = parseRawData(data);
      if (parsedData) {
        // Step 12: Store this data to the database
        await storeLocation(parsedData);
      } else {
        console.log(`[TCP] Unrecognized data from ${socket.remoteAddress}:`, data.toString('hex'));
      }
      
      // Acknowledge receipt
      socket.write(Buffer.from('ACK\\n'));
    });

    socket.on('end', () => {
      console.log(`[TCP] GPS Device disconnected: ${socket.remoteAddress}`);
    });

    socket.on('error', (err) => {
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
