import pool from '../db';

export const generateTripReport = async (companyId: string, startDate: Date, endDate: Date, vehicleId?: string) => {
  let queryStr = `
    SELECT t.*, 
      json_build_object('id', v.id, 'vehicleNumber', v."vehicleNumber") as vehicle
    FROM "Trip" t
    JOIN "Vehicle" v ON t."vehicleId" = v.id
    WHERE v."companyId" = $1 
      AND t."createdAt" >= $2 
      AND t."createdAt" <= $3
  `;
  const params: any[] = [companyId, startDate, endDate];
  if (vehicleId && vehicleId !== 'undefined' && vehicleId !== 'null' && vehicleId !== '') {
    params.push(vehicleId);
    queryStr += ` AND v.id = $${params.length}`;
  }
  queryStr += ` ORDER BY t."createdAt" DESC`;
  
  const tripsRes = await pool.query(queryStr, params);
  let trips = tripsRes.rows;

  // Fallback: If no manual Trip records exist for this period, synthesize trip analytics directly from real-time GPS tracking history in VehicleLocation
  if (trips.length === 0) {
    let locQuery = `
      SELECT 
        CONCAT('synth-', v.id) as id,
        json_build_object('id', v.id, 'vehicleNumber', v."vehicleNumber") as vehicle,
        MIN(vl.timestamp) as "createdAt",
        MAX(vl.timestamp) as "endTime",
        ROUND(COALESCE((COUNT(vl.id) * 0.8), 0)::numeric, 1)::float as distance,
        ROUND(COALESCE(EXTRACT(EPOCH FROM (MAX(vl.timestamp) - MIN(vl.timestamp))) / 60, 0)::numeric, 0)::int as duration,
        'COMPLETED' as status
      FROM "Vehicle" v
      JOIN "VehicleLocation" vl ON v.id = vl."vehicleId"
      WHERE v."companyId" = $1 
        AND vl.timestamp >= $2 
        AND vl.timestamp <= $3
    `;
    const locParams: any[] = [companyId, startDate, endDate];
    if (vehicleId && vehicleId !== 'undefined' && vehicleId !== 'null' && vehicleId !== '') {
      locParams.push(vehicleId);
      locQuery += ` AND v.id = $${locParams.length}`;
    }
    locQuery += ` GROUP BY v.id, v."vehicleNumber" HAVING COUNT(vl.id) > 0 ORDER BY MIN(vl.timestamp) DESC`;
    
    const locRes = await pool.query(locQuery, locParams);
    trips = locRes.rows;
  }

  const totalDistance = trips.reduce((sum, trip) => sum + Number(trip.distance || 0), 0);
  const totalDuration = trips.reduce((sum, trip) => sum + Number(trip.duration || 0), 0);

  return {
    summary: {
      totalTrips: trips.length,
      totalDistance: Number(totalDistance.toFixed(1)),
      totalDuration,
    },
    data: trips,
  };
};

export const generateAlertReport = async (companyId: string, startDate: Date, endDate: Date, typeOrVehicleId?: string) => {
  let queryStr = `
    SELECT a.*, 
      json_build_object('id', v.id, 'vehicleNumber', v."vehicleNumber") as vehicle
    FROM "Alert" a
    JOIN "Vehicle" v ON a."vehicleId" = v.id
    WHERE v."companyId" = $1 
      AND a."createdAt" >= $2 
      AND a."createdAt" <= $3
  `;
  const params: any[] = [companyId, startDate, endDate];
  if (typeOrVehicleId && typeOrVehicleId !== 'undefined' && typeOrVehicleId !== 'null' && typeOrVehicleId !== '') {
    if (typeOrVehicleId.includes('-')) {
      params.push(typeOrVehicleId);
      queryStr += ` AND v.id = $${params.length}`;
    } else {
      params.push(typeOrVehicleId);
      queryStr += ` AND a.type = $${params.length}`;
    }
  }
  queryStr += ` ORDER BY a."createdAt" DESC`;
  const alertsRes = await pool.query(queryStr, params);

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
