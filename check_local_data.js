const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', password: 'Pok@l7449', host: 'localhost', port: 5432, database: 'fleet_db' });

async function run() {
  const dev = await pool.query('SELECT * FROM "GpsDevice" WHERE imei = \'356218606767505\'');
  console.log('GpsDevice:', dev.rows);
  if (dev.rows.length > 0) {
    const veh = await pool.query('SELECT * FROM "Vehicle" WHERE "gpsDeviceId" = $1', [dev.rows[0].id]);
    console.log('Vehicle:', veh.rows);
  }
  process.exit(0);
}
run();
