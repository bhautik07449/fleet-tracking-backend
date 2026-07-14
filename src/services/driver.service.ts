import prisma from '../prisma';

export const getDriversByCompanyId = async (companyId: string, skip: number = 0, take: number = 10) => {
  return prisma.driver.findMany({
    where: { companyId },
    skip,
    take,
    include: {
      vehicles: { select: { id: true, vehicleNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getDriverByIdAndCompanyId = async (driverId: string, companyId: string) => {
  const driver = await prisma.driver.findFirst({
    where: { id: driverId, companyId },
    include: {
      vehicles: { select: { id: true, vehicleNumber: true } },
    },
  });

  if (!driver) throw new Error('Driver not found in your company');
  return driver;
};

export const createDriver = async (companyId: string, data: any) => {
  const existing = await prisma.driver.findUnique({ where: { licenseNumber: data.licenseNumber } });
  if (existing) throw new Error('Driver license number already exists');

  return prisma.driver.create({
    data: {
      companyId,
      name: data.name,
      licenseNumber: data.licenseNumber,
      contactInfo: data.contactInfo,
    },
  });
};

export const updateDriver = async (driverId: string, companyId: string, data: any) => {
  const driver = await prisma.driver.findFirst({ where: { id: driverId, companyId } });
  if (!driver) throw new Error('Driver not found in your company');

  if (data.licenseNumber && data.licenseNumber !== driver.licenseNumber) {
    const existing = await prisma.driver.findUnique({ where: { licenseNumber: data.licenseNumber } });
    if (existing) throw new Error('Driver license number already exists');
  }

  return prisma.driver.update({
    where: { id: driverId },
    data: {
      name: data.name !== undefined ? data.name : driver.name,
      licenseNumber: data.licenseNumber !== undefined ? data.licenseNumber : driver.licenseNumber,
      contactInfo: data.contactInfo !== undefined ? data.contactInfo : driver.contactInfo,
    },
  });
};

export const deleteDriver = async (driverId: string, companyId: string) => {
  const driver = await prisma.driver.findFirst({ where: { id: driverId, companyId } });
  if (!driver) throw new Error('Driver not found in your company');

  return prisma.driver.delete({
    where: { id: driverId },
  });
};
