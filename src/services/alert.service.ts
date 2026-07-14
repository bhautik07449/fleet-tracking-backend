import prisma from '../prisma';
import { sendCriticalAlertEmail } from './notification.service';

export const getAlertsByCompanyId = async (companyId: string, skip: number = 0, take: number = 10, isResolved?: boolean) => {
  const whereClause: any = { vehicle: { companyId } };
  
  if (isResolved !== undefined) {
    whereClause.isResolved = isResolved;
  }

  return prisma.alert.findMany({
    where: whereClause,
    skip,
    take,
    include: {
      vehicle: { select: { id: true, vehicleNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const createSystemAlert = async (vehicleId: string, companyId: string, type: any, message: string) => {
  // Validate that the vehicle belongs to this company
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, companyId } });
  if (!vehicle) throw new Error('Vehicle not found in your company');

  const alert = await prisma.alert.create({
    data: {
      vehicleId,
      type,
      message,
      isResolved: false,
    },
  });

  // Here, we could also emit this via Socket.IO immediately
  const io = require('../socket').getIO();
  io.to(companyId).emit('new-alert', alert);

  // Send Email for Critical Alerts
  if (type === 'SOS' || type === 'OVERSPEED' || type === 'POWER_CUT') {
    sendCriticalAlertEmail(companyId, { ...alert, vehicleNumber: vehicle.vehicleNumber });
  }

  return alert;
};

export const resolveAlert = async (alertId: string, companyId: string) => {
  const alert = await prisma.alert.findFirst({
    where: { id: alertId, vehicle: { companyId } },
  });

  if (!alert) throw new Error('Alert not found in your company');

  return prisma.alert.update({
    where: { id: alertId },
    data: { isResolved: true },
  });
};

export const deleteAlert = async (alertId: string, companyId: string) => {
  const alert = await prisma.alert.findFirst({
    where: { id: alertId, vehicle: { companyId } },
  });

  if (!alert) throw new Error('Alert not found in your company');

  return prisma.alert.delete({
    where: { id: alertId },
  });
};
