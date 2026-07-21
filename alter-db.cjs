const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  password: 'Pok@l7449',
  host: 'localhost',
  port: 5432,
  database: 'trade'
});

async function run() {
  try {
    await pool.query('ALTER TABLE "Driver" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT FALSE;');
    console.log('Added isActive to Driver');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('Column already exists, ignoring.');
    } else {
      console.error(e.message);
    }
  }
  process.exit(0);
}
run();
