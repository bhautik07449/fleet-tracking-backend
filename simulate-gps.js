const net = require('net');

const args = process.argv.slice(2);
const imei = args[0] || '123456789012345';
const PORT = 4000;
const HOST = '127.0.0.1';

const client = new net.Socket();

client.connect(PORT, HOST, () => {
  console.log(`Connected to GPS TCP Server at ${HOST}:${PORT}`);
  
  // Starting coordinates
  let lat = 42.567902;
  let lng = 16.909683;
  
  setInterval(() => {
    // Move slightly
    lat += (Math.random() - 0.2) * 0.001; 
    lng += (Math.random() - 0.2) * 0.001;
    
    const packet = JSON.stringify({
      imei,
      latitude: parseFloat(lat.toFixed(6)),
      longitude: parseFloat(lng.toFixed(6)),
      speed: Math.floor(Math.random() * 60 + 20),
      heading: Math.floor(Math.random() * 360),
      altitude: 10,
      ignitionStatus: true,
      timestamp: new Date().toISOString()
    }) + '\\n';
    
    console.log(`Sending: ${packet.trim()}`);
    client.write(packet);
  }, 3000); // Send data every 3 seconds
});

client.on('data', (data) => {
  console.log(`Received from server: ${data.toString()}`);
});

client.on('close', () => {
  console.log('Connection closed');
});

client.on('error', (err) => {
  console.error(`Error: ${err.message}`);
});
