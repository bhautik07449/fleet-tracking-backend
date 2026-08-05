import pool from '../db';

// Precise geodetic Haversine formula to calculate accurate distance in kilometers between two latitude/longitude coordinates
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (val: number) => (val * Math.PI) / 180;
  const R = 6371.0; // Earth's mean radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

  // For any manual trip with uncalculated distance, compute accurate Haversine distance from GPS logs
  for (const trip of trips) {
    if (!trip.distance || Number(trip.distance) === 0) {
      const startT = trip.startTime || trip.createdAt || startDate;
      const endT = trip.endTime || new Date();
      const vId = trip.vehicle?.id || trip.vehicleId;
      if (vId) {
        const ptsRes = await pool.query(
          `SELECT latitude, longitude, speed FROM "VehicleLocation" WHERE "vehicleId" = $1 AND timestamp >= $2 AND timestamp <= $3 ORDER BY timestamp ASC`,
          [vId, startT, endT]
        );
        let computedDist = 0;
        const pts = ptsRes.rows;
        for (let i = 0; i < pts.length - 1; i++) {
          const dist = calculateHaversineDistance(
            Number(pts[i].latitude), Number(pts[i].longitude),
            Number(pts[i + 1].latitude), Number(pts[i + 1].longitude)
          );
          if (dist > 0.003 || Number(pts[i + 1].speed) > 2) {
            computedDist += dist;
          }
        }
        trip.distance = Number(computedDist.toFixed(2));
      }
    }
  }

  // Fallback: If no manual Trip records exist for this period, synthesize trip analytics directly from real-time GPS tracking history in VehicleLocation using exact Haversine mathematics
  if (trips.length === 0) {
    let locQuery = `
      SELECT v.id as "vehicleId", v."vehicleNumber", vl.latitude, vl.longitude, vl.timestamp, vl.speed
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
    locQuery += ` ORDER BY v.id, vl.timestamp ASC`;
    
    const locRes = await pool.query(locQuery, locParams);
    const rows = locRes.rows;

    // Group coordinates by vehicle asset
    const vehicleGroups: { [key: string]: any[] } = {};
    for (const row of rows) {
      if (!vehicleGroups[row.vehicleId]) {
        vehicleGroups[row.vehicleId] = [];
      }
      vehicleGroups[row.vehicleId].push(row);
    }

    trips = Object.keys(vehicleGroups).map((vId) => {
      const points = vehicleGroups[vId];
      let totalDist = 0;
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const dist = calculateHaversineDistance(
          Number(p1.latitude), Number(p1.longitude),
          Number(p2.latitude), Number(p2.longitude)
        );
        // Filter out minor GPS drift jitter (<3 meters) when stationary
        if (dist > 0.003 || Number(p2.speed) > 2) {
          totalDist += dist;
        }
      }

      const startPoint = points[0];
      const endPoint = points[points.length - 1];
      const startTime = new Date(startPoint.timestamp).getTime();
      const endTime = new Date(endPoint.timestamp).getTime();
      const durationMins = Math.round((endTime - startTime) / 60000);

      return {
        id: `synth-${vId}`,
        vehicle: { id: vId, vehicleNumber: startPoint.vehicleNumber },
        createdAt: startPoint.timestamp,
        endTime: endPoint.timestamp,
        distance: Number(totalDist.toFixed(2)),
        duration: durationMins,
        status: 'COMPLETED'
      };
    });
  }

  const totalDistance = trips.reduce((sum, trip) => sum + Number(trip.distance || 0), 0);
  const totalDuration = trips.reduce((sum, trip) => sum + Number(trip.duration || 0), 0);

  return {
    summary: {
      totalTrips: trips.length,
      totalDistance: Number(totalDistance.toFixed(2)),
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
