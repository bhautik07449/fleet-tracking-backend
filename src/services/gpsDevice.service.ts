import prisma from '../prisma';

export const getDevicesByCompanyId = async (companyId: string, skip: number = 0, take: number = 10) => {
  return prisma.gpsDevice.findMany({
    where: { companyId },
    skip,
    take,
    include: {
      vehicle: { select: { id: true, vehicleNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getDeviceByIdAndCompanyId = async (deviceId: string, companyId: string) => {
  const device = await prisma.gpsDevice.findFirst({
    where: { id: deviceId, companyId },
    include: {
      vehicle: { select: { id: true, vehicleNumber: true } },
    },
  });

  if (!device) throw new Error('GPS Device not found in your company');
  return device;
};

export const createDevice = async (companyId: string, data: any) => {
  const existing = await prisma.gpsDevice.findUnique({ where: { imei: data.imei } });
  if (existing) throw new Error('GPS Device IMEI already exists');

  return prisma.gpsDevice.create({
    data: {
      companyId,
      imei: data.imei,
      deviceModel: data.deviceModel,
      simNumber: data.simNumber,
      status: data.status || 'ACTIVE',
    },
  });
};

export const updateDevice = async (deviceId: string, companyId: string, data: any) => {
  const device = await prisma.gpsDevice.findFirst({ where: { id: deviceId, companyId } });
  if (!device) throw new Error('GPS Device not found in your company');

  if (data.imei && data.imei !== device.imei) {
    const existing = await prisma.gpsDevice.findUnique({ where: { imei: data.imei } });
    if (existing) throw new Error('GPS Device IMEI already exists');
  }

  return prisma.gpsDevice.update({
    where: { id: deviceId },
    data: {
      imei: data.imei !== undefined ? data.imei : device.imei,
      deviceModel: data.deviceModel !== undefined ? data.deviceModel : device.deviceModel,
      simNumber: data.simNumber !== undefined ? data.simNumber : device.simNumber,
      status: data.status !== undefined ? data.status : device.status,
    },
  });
};

export const deleteDevice = async (deviceId: string, companyId: string) => {
  const device = await prisma.gpsDevice.findFirst({ where: { id: deviceId, companyId } });
  if (!device) throw new Error('GPS Device not found in your company');

  return prisma.gpsDevice.delete({
    where: { id: deviceId },
  });
};
