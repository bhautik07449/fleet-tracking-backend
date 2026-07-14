import prisma from '../prisma';

export const getTripsByCompanyId = async (companyId: string, skip: number = 0, take: number = 10) => {
  return prisma.trip.findMany({
    where: { vehicle: { companyId } },
    skip,
    take,
    include: {
      vehicle: { select: { id: true, vehicleNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const startTrip = async (vehicleId: string, companyId: string, startLocation: any) => {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, companyId } });
  if (!vehicle) throw new Error('Vehicle not found in your company');

  const ongoingTrip = await prisma.trip.findFirst({
    where: { vehicleId, status: 'ONGOING' },
  });

  if (ongoingTrip) throw new Error('Vehicle already has an ongoing trip');

  return prisma.trip.create({
    data: {
      vehicleId,
      startLocation,
      status: 'ONGOING',
    },
  });
};

export const endTrip = async (tripId: string, companyId: string, endLocation: any) => {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, vehicle: { companyId } },
  });

  if (!trip) throw new Error('Trip not found');
  if (trip.status !== 'ONGOING') throw new Error('Trip is already completed or cancelled');

  // Calculate approximate duration in seconds
  const startTime = new Date(trip.startTime).getTime();
  const endTime = new Date().getTime();
  const duration = Math.floor((endTime - startTime) / 1000);

  // Note: For a production app, the distance should be calculated by summing the Haversine distances 
  // between all GPS points logged for this vehicle between startTime and endTime.
  // We will leave distance as 0 or a placeholder here unless we do the DB query.

  return prisma.trip.update({
    where: { id: tripId },
    data: {
      endLocation,
      status: 'COMPLETED',
      endTime: new Date(),
      duration,
    },
  });
};

export const getOngoingTrip = async (vehicleId: string, companyId: string) => {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, companyId } });
  if (!vehicle) throw new Error('Vehicle not found in your company');

  return prisma.trip.findFirst({
    where: { vehicleId, status: 'ONGOING' },
  });
};
