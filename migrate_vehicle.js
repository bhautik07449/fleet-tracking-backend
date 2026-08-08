/**
 * LIVE SERVER MIGRATION SCRIPT
 * Run this on your live server ONCE to add missing Vehicle columns and update enums.
 * Command: node migrate_vehicle.js
 * After running successfully, you can delete this file.
 */
require('dotenv').config();
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:Pok@l7449@localhost:5432/fleet_db?schema=public";
console.log("Connecting to database using connectionString...");

const pool = new Pool({
  connectionString
});

async function migrate() {
  const migrations = [
    { col: "lastLatitude",  sql: `ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "lastLatitude" DOUBLE PRECISION` },
    { col: "lastLongitude", sql: `ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "lastLongitude" DOUBLE PRECISION` },
    { col: "lastSpeed",     sql: `ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "lastSpeed" DOUBLE PRECISION DEFAULT 0` },
    { col: "lastSeen",      sql: `ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "lastSeen" TIMESTAMP WITH TIME ZONE` },
    { col: "maxSpeed",      sql: `ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "maxSpeed" INTEGER DEFAULT 80` },
    { col: "engineStatus",  sql: `ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "engineStatus" TEXT NOT NULL DEFAULT 'ON'` },
  ];

  const enumValues = ["Moving", "Stopped", "Idle", "Inactive", "No data", "Overspeed"];

  console.log("=== Adding missing Vehicle columns ===");
  for (const m of migrations) {
    try { await pool.query(m.sql); console.log("OK:", m.col); }
    catch (e) { console.error("FAIL:", m.col, e.message); }
  }

  console.log("\n=== Adding new VehicleStatus enum values ===");
  for (const val of enumValues) {
    try { await pool.query(`ALTER TYPE "VehicleStatus" ADD VALUE '${val}'`); console.log("OK enum:", val); }
    catch (e) { console.log("Already exists or error:", val, e.message); }
  }

  console.log("\n=== Migrating old status values ===");
  try {
    await pool.query(`UPDATE "Vehicle" SET status = 'Inactive' WHERE status = 'OFFLINE'`);
    await pool.query(`UPDATE "Vehicle" SET status = 'Moving'   WHERE status = 'RUNNING'`);
    await pool.query(`UPDATE "Vehicle" SET status = 'Stopped'  WHERE status = 'STOPPED'`);
    await pool.query(`UPDATE "Vehicle" SET status = 'Idle'     WHERE status = 'IDLE'`);
    await pool.query(`UPDATE "Vehicle" SET status = 'Moving'   WHERE status = 'TOWING'`);
    console.log("Status migration done.");
  } catch(e) { console.error("Status migration error:", e.message); }

  console.log("\nDone! You can delete this file now.");
  process.exit(0);
}
migrate().catch(e => { console.error(e.message); process.exit(1); });
