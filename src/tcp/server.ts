import net from 'net';
import { parseRawData } from '../gps/parser';
import { processLocationUpdate } from '../services/location.service';

const TCP_PORT = process.env.TCP_PORT ? parseInt(process.env.TCP_PORT) : 4000;

export const startTcpServer = () => {
  const server = net.createServer((socket) => {
    console.log(`[TCP] GPS Device connected: ${socket.remoteAddress}:${socket.remotePort}`);

    socket.on('data', async (data) => {
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
