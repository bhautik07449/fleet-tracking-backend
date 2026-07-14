import prisma from '../prisma';
import { ParsedGPSData } from '../gps/parser';

export const storeLocation = async (data: ParsedGPSData) => {
  try {
    // 1. Find the vehicle associated with this GPS Device IMEI
    const device = await prisma.gpsDevice.findUnique({
      where: { imei: data.imei },
      include: { vehicle: true },
    });

    if (!device) {
      console.warn(`[Location Service] GPS Device with IMEI ${data.imei} not found.`);
      return;
    }

    if (!device.vehicle) {
      console.warn(`[Location Service] GPS Device with IMEI ${data.imei} is not assigned to any vehicle.`);
      return;
    }

    const vehicleId = device.vehicle.id;

    // 2. Insert the location data
    const location = await prisma.vehicleLocation.create({
      data: {
        vehicleId,
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        heading: data.heading,
        altitude: data.altitude,
        battery: data.battery,
        ignitionStatus: data.ignitionStatus,
        timestamp: data.timestamp,
      },
    });

    // 3. Update the device's lastSeen timestamp and vehicle status
    const status = data.speed > 0 ? 'RUNNING' : 'STOPPED';

    await prisma.$transaction([
      prisma.gpsDevice.update({
        where: { id: device.id },
        data: { lastSeen: data.timestamp },
      }),
      prisma.vehicle.update({
        where: { id: vehicleId },
        data: { status },
      }),
    ]);

    // 4. Broadcast live location update to the company's socket room
    const io = require('../socket').getIO();
    io.to(device.companyId).emit('vehicle-location-update', {
      vehicleId,
      vehicleNumber: device.vehicle.vehicleNumber,
      latitude: data.latitude,
      longitude: data.longitude,
      speed: data.speed,
      heading: data.heading,
      status,
      timestamp: data.timestamp,
    });

    console.log(`[Location Service] Stored and broadcasted location for Vehicle ${device.vehicle.vehicleNumber}`);
    
    return location;
  } catch (error) {
    console.error('[Location Service] Error storing location:', error);
  }
};
