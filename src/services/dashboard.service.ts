import pool from '../db';

export const getDashboardMetrics = async (companyId: string) => {
  // 1. Vehicle Metrics
  const vehiclesRes = await pool.query('SELECT status, count(*) as count FROM "Vehicle" WHERE "companyId" = $1 GROUP BY status', [companyId]);
  let totalVehicles = 0;
  let runningVehicles = 0;
  let stoppedVehicles = 0;
  
  vehiclesRes.rows.forEach(row => {
    const count = parseInt(row.count);
    totalVehicles += count;
    if (row.status === 'RUNNING') runningVehicles += count;
    if (row.status === 'STOPPED') stoppedVehicles += count;
  });

  // 2. Trip Metrics
  const tripsRes = await pool.query(`
    SELECT count(*) FROM "Trip" t
    JOIN "Vehicle" v ON t."vehicleId" = v.id
    WHERE v."companyId" = $1 AND t.status = 'ONGOING'
  `, [companyId]);
  const ongoingTrips = parseInt(tripsRes.rows[0].count);

  // 3. Alert Metrics (Today's alerts)
  const alertsRes = await pool.query(`
    SELECT "isRead", count(*) as count FROM "Alert" a
    JOIN "Vehicle" v ON a."vehicleId" = v.id
    WHERE v."companyId" = $1 AND a."createdAt" >= CURRENT_DATE
    GROUP BY "isRead"
  `, [companyId]);
  
  let todayAlerts = 0;
  let unresolvedAlerts = 0;
  
  alertsRes.rows.forEach(row => {
    const count = parseInt(row.count);
    todayAlerts += count;
    if (!row.isRead) unresolvedAlerts += count;
  });

  // 4. Driver Metrics
  const driversRes = await pool.query('SELECT count(*) FROM "Driver" WHERE "companyId" = $1', [companyId]);
  const totalDrivers = parseInt(driversRes.rows[0].count);

  return {
    vehicles: {
      total: totalVehicles,
      running: runningVehicles,
      stopped: stoppedVehicles,
    },
    trips: {
      ongoing: ongoingTrips,
    },
    alerts: {
      today: todayAlerts,
      unresolved: unresolvedAlerts,
    },
    drivers: {
      total: totalDrivers,
    }
  };
};
