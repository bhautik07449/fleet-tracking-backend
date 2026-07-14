import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as gpsDeviceService from '../services/gpsDevice.service';
import { sendSuccess, sendError } from '../utils/response';
import { createGpsDeviceSchema, updateGpsDeviceSchema } from '../validators/gpsDevice.validator';

export const getDevices = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const devices = await gpsDeviceService.getGpsDevices(companyId, skip, limit);
    return sendSuccess(res, 200, 'GPS Devices retrieved successfully', { devices, page, limit });
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to retrieve devices');
  }
};

export const getDevice = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const device = await gpsDeviceService.getGpsDeviceById(req.params.id as string, companyId);
    return sendSuccess(res, 200, 'GPS Device retrieved successfully', device);
  } catch (error: any) {
    return sendError(res, 404, error.message || 'GPS Device not found');
  }
};

export const createGpsDevice = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    
    const { error, value } = createGpsDeviceSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const newDevice = await gpsDeviceService.createGpsDevice(companyId, value);
    return sendSuccess(res, 201, 'GPS Device created successfully', newDevice);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to create GPS device');
  }
};

export const updateGpsDevice = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;

    const { error, value } = updateGpsDeviceSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const updatedDevice = await gpsDeviceService.updateGpsDevice(req.params.id as string, companyId, value);
    return sendSuccess(res, 200, 'GPS Device updated successfully', updatedDevice);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to update GPS device');
  }
};

export const deleteGpsDevice = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    await gpsDeviceService.deleteGpsDevice(req.params.id as string, companyId);
    return sendSuccess(res, 200, 'GPS Device deleted successfully');
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to delete GPS device');
  }
};
