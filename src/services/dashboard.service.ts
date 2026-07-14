import prisma from '../prisma';

export const getDashboardMetrics = async (companyId: string) => {
  // 1. Vehicle Stats
  const totalVehicles = await prisma.vehicle.count({ where: { companyId } });
  const runningVehicles = await prisma.vehicle.count({ where: { companyId, status: 'RUNNING' } });
  const stoppedVehicles = await prisma.vehicle.count({ where: { companyId, status: 'STOPPED' } });
  const offlineVehicles = await prisma.vehicle.count({ where: { companyId, status: 'OFFLINE' } });

  // 2. Driver Stats
  const totalDrivers = await prisma.driver.count({ where: { companyId } });

  // 3. Alerts (Today)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const alertsToday = await prisma.alert.count({
    where: {
      vehicle: { companyId },
      createdAt: { gte: startOfDay },
    },
  });

  const unresolvedAlerts = await prisma.alert.count({
    where: {
      vehicle: { companyId },
      isResolved: false,
    },
  });

  // 4. Trips (Ongoing)
  const ongoingTrips = await prisma.trip.count({
    where: {
      vehicle: { companyId },
      status: 'ONGOING',
    },
  });

  return {
    vehicles: {
      total: totalVehicles,
      running: runningVehicles,
      stopped: stoppedVehicles,
      offline: offlineVehicles,
    },
    drivers: {
      total: totalDrivers,
    },
    alerts: {
      today: alertsToday,
      unresolved: unresolvedAlerts,
    },
    trips: {
      ongoing: ongoingTrips,
    },
  };
};
