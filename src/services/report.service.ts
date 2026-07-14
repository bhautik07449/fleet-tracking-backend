import pool from '../db';

export const generateTripReport = async (companyId: string, startDate: Date, endDate: Date, vehicleId?: string) => {
  const tripsRes = await pool.query(`
    SELECT t.*, 
      json_build_object('id', v.id, 'vehicleNumber', v."vehicleNumber") as vehicle
    FROM "Trip" t
    JOIN "Vehicle" v ON t."vehicleId" = v.id
    WHERE v."companyId" = $1 
      AND t."createdAt" >= $2 
      AND t."createdAt" <= $3
    ORDER BY t."createdAt" DESC
  `, [companyId, startDate, endDate]);

  const trips = tripsRes.rows;

  const totalDistance = trips.reduce((sum, trip) => sum + (trip.distance || 0), 0);
  const totalDuration = trips.reduce((sum, trip) => sum + (trip.duration || 0), 0);

  return {
    summary: {
      totalTrips: trips.length,
      totalDistance,
      totalDuration,
    },
    data: trips,
  };
};

export const generateAlertReport = async (companyId: string, startDate: Date, endDate: Date, type?: string) => {
  const alertsRes = await pool.query(`
    SELECT a.*, 
      json_build_object('id', v.id, 'vehicleNumber', v."vehicleNumber") as vehicle
    FROM "Alert" a
    JOIN "Vehicle" v ON a."vehicleId" = v.id
    WHERE v."companyId" = $1 
      AND a."createdAt" >= $2 
      AND a."createdAt" <= $3
    ORDER BY a."createdAt" DESC
  `, [companyId, startDate, endDate]);

  const alerts = alertsRes.rows.map(row => ({
    ...row,
    isResolved: row.isRead
  }));

  const unresolvedAlerts = alerts.filter(a => !a.isResolved).length;

  return {
    summary: {
      totalAlerts: alerts.length,
      unresolvedAlerts,
    },
    data: alerts,
  };
};
