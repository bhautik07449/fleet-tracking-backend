const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'Pok@l7449',
  host: 'localhost',
  port: 5432,
  database: 'trade'
});

async function run() {
  const newStatuses = [
    'Moving',
    'Stopped',
    'Idle',
    'Inactive',
    'No data',
    'Overspeed'
  ];

  for (const status of newStatuses) {
    try {
      await pool.query(`ALTER TYPE "VehicleStatus" ADD VALUE '${status}';`);
      console.log(`Added ${status} to VehicleStatus`);
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log(`Value ${status} already exists, ignoring.`);
      } else {
        console.error(`Error adding ${status}:`, e.message);
      }
    }
  }

  // Set any existing OFFLINE to Inactive, RUNNING to Moving, STOPPED to Stopped, IDLE to Idle, TOWING to Moving
  try {
    await pool.query(`UPDATE "Vehicle" SET status = 'Inactive' WHERE status = 'OFFLINE';`);
    await pool.query(`UPDATE "Vehicle" SET status = 'Moving' WHERE status = 'RUNNING';`);
    await pool.query(`UPDATE "Vehicle" SET status = 'Stopped' WHERE status = 'STOPPED';`);
    await pool.query(`UPDATE "Vehicle" SET status = 'Moving' WHERE status = 'TOWING';`);
    await pool.query(`UPDATE "Vehicle" SET status = 'Idle' WHERE status = 'IDLE';`);
    
    console.log('Migrated old status string values in Vehicle table.');
  } catch (e) {
    console.error('Error migrating old statuses:', e.message);
  }

  process.exit(0);
}

run();
