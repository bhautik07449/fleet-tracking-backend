import prisma from '../prisma';

export const getGeofencesByCompanyId = async (companyId: string, skip: number = 0, take: number = 10) => {
  return prisma.geofence.findMany({
    where: { companyId },
    skip,
    take,
    orderBy: { createdAt: 'desc' },
  });
};

export const getGeofenceByIdAndCompanyId = async (geofenceId: string, companyId: string) => {
  const geofence = await prisma.geofence.findFirst({
    where: { id: geofenceId, companyId },
  });

  if (!geofence) throw new Error('Geofence not found in your company');
  return geofence;
};

export const createGeofence = async (companyId: string, data: any) => {
  return prisma.geofence.create({
    data: {
      companyId,
      name: data.name,
      type: data.type,
      coordinates: data.coordinates, // stored as JSON
      radius: data.radius || null,
    },
  });
};

export const updateGeofence = async (geofenceId: string, companyId: string, data: any) => {
  const geofence = await prisma.geofence.findFirst({ where: { id: geofenceId, companyId } });
  if (!geofence) throw new Error('Geofence not found in your company');

  return prisma.geofence.update({
    where: { id: geofenceId },
    data: {
      name: data.name !== undefined ? data.name : geofence.name,
      type: data.type !== undefined ? data.type : geofence.type,
      coordinates: data.coordinates !== undefined ? data.coordinates : geofence.coordinates,
      radius: data.radius !== undefined ? data.radius : geofence.radius,
    },
  });
};

export const deleteGeofence = async (geofenceId: string, companyId: string) => {
  const geofence = await prisma.geofence.findFirst({ where: { id: geofenceId, companyId } });
  if (!geofence) throw new Error('Geofence not found in your company');

  return prisma.geofence.delete({
    where: { id: geofenceId },
  });
};
