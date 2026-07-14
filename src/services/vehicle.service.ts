import prisma from '../prisma';

export const getVehiclesByCompanyId = async (companyId: string, skip: number = 0, take: number = 10) => {
  return prisma.vehicle.findMany({
    where: { companyId },
    skip,
    take,
    include: {
      driver: { select: { id: true, name: true, contactInfo: true } },
      gpsDevice: { select: { id: true, imei: true, lastSeen: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getVehicleByIdAndCompanyId = async (vehicleId: string, companyId: string) => {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, companyId },
    include: {
      driver: { select: { id: true, name: true, contactInfo: true } },
      gpsDevice: { select: { id: true, imei: true, lastSeen: true } },
    },
  });

  if (!vehicle) throw new Error('Vehicle not found in your company');
  return vehicle;
};

export const createVehicle = async (companyId: string, data: any) => {
  const existing = await prisma.vehicle.findUnique({ where: { vehicleNumber: data.vehicleNumber } });
  if (existing) throw new Error('Vehicle number already exists');

  // Verify that gpsDeviceId is unique globally if provided
  if (data.gpsDeviceId) {
    const existingDevice = await prisma.vehicle.findUnique({ where: { gpsDeviceId: data.gpsDeviceId } });
    if (existingDevice) throw new Error('GPS Device is already assigned to another vehicle');
  }

  return prisma.vehicle.create({
    data: {
      companyId,
      vehicleNumber: data.vehicleNumber,
      type: data.type,
      model: data.model,
      driverId: data.driverId || null,
      gpsDeviceId: data.gpsDeviceId || null,
    },
  });
};

export const updateVehicle = async (vehicleId: string, companyId: string, data: any) => {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, companyId } });
  if (!vehicle) throw new Error('Vehicle not found in your company');

  if (data.vehicleNumber && data.vehicleNumber !== vehicle.vehicleNumber) {
    const existing = await prisma.vehicle.findUnique({ where: { vehicleNumber: data.vehicleNumber } });
    if (existing) throw new Error('Vehicle number already exists');
  }

  if (data.gpsDeviceId && data.gpsDeviceId !== vehicle.gpsDeviceId) {
    const existingDevice = await prisma.vehicle.findUnique({ where: { gpsDeviceId: data.gpsDeviceId } });
    if (existingDevice) throw new Error('GPS Device is already assigned to another vehicle');
  }

  return prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      vehicleNumber: data.vehicleNumber !== undefined ? data.vehicleNumber : vehicle.vehicleNumber,
      type: data.type !== undefined ? data.type : vehicle.type,
      model: data.model !== undefined ? data.model : vehicle.model,
      driverId: data.driverId !== undefined ? data.driverId : vehicle.driverId,
      gpsDeviceId: data.gpsDeviceId !== undefined ? data.gpsDeviceId : vehicle.gpsDeviceId,
      status: data.status !== undefined ? data.status : vehicle.status,
    },
  });
};

export const deleteVehicle = async (vehicleId: string, companyId: string) => {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, companyId } });
  if (!vehicle) throw new Error('Vehicle not found in your company');

  return prisma.vehicle.delete({
    where: { id: vehicleId },
  });
};
