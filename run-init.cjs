const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  user: 'postgres',
  password: 'Pok@l7449',
  host: 'localhost',
  port: 5432,
  database: 'trade'
});

async function run() {
  try {
    const sql = fs.readFileSync('src/db/init.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Database Initialization Successful!');
  } catch (e) {
    console.error('❌ Database Init Failed:', e.message);
  }
  process.exit(0);
}
run();
