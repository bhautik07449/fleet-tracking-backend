import prisma from '../prisma';

export const getTripReport = async (companyId: string, startDate: Date, endDate: Date, vehicleId?: string) => {
  const whereClause: any = {
    vehicle: { companyId },
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (vehicleId) {
    whereClause.vehicleId = vehicleId;
  }

  const trips = await prisma.trip.findMany({
    where: whereClause,
    include: {
      vehicle: { select: { vehicleNumber: true, type: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate some basic aggregations
  const totalTrips = trips.length;
  const totalDuration = trips.reduce((acc, trip) => acc + (trip.duration || 0), 0);
  const totalDistance = trips.reduce((acc, trip) => acc + (trip.distance || 0), 0);

  return {
    summary: { totalTrips, totalDuration, totalDistance },
    data: trips,
  };
};

export const getAlertReport = async (companyId: string, startDate: Date, endDate: Date, vehicleId?: string) => {
  const whereClause: any = {
    vehicle: { companyId },
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (vehicleId) {
    whereClause.vehicleId = vehicleId;
  }

  const alerts = await prisma.alert.findMany({
    where: whereClause,
    include: {
      vehicle: { select: { vehicleNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Aggregation by type
  const alertCountsByType = alerts.reduce((acc: any, alert) => {
    acc[alert.type] = (acc[alert.type] || 0) + 1;
    return acc;
  }, {});

  return {
    summary: {
      totalAlerts: alerts.length,
      unresolvedAlerts: alerts.filter((a) => !a.isResolved).length,
      breakdown: alertCountsByType,
    },
    data: alerts,
  };
};
