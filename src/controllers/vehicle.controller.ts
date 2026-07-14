import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as vehicleService from '../services/vehicle.service';
import { sendSuccess, sendError } from '../utils/response';
import { createVehicleSchema, updateVehicleSchema } from '../validators/vehicle.validator';

export const getVehicles = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const vehicles = await vehicleService.getVehicles(companyId, skip, limit);
    return sendSuccess(res, 200, 'Vehicles retrieved successfully', { vehicles, page, limit });
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to retrieve vehicles');
  }
};

export const getVehicle = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const vehicle = await vehicleService.getVehicleById(req.params.id as string, companyId);
    return sendSuccess(res, 200, 'Vehicle retrieved successfully', vehicle);
  } catch (error: any) {
    return sendError(res, 404, error.message || 'Vehicle not found');
  }
};

export const createVehicle = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    
    const { error, value } = createVehicleSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const newVehicle = await vehicleService.createVehicle(companyId, value);
    return sendSuccess(res, 201, 'Vehicle created successfully', newVehicle);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to create vehicle');
  }
};

export const updateVehicle = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;

    const { error, value } = updateVehicleSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const updatedVehicle = await vehicleService.updateVehicle(req.params.id as string, companyId, value);
    return sendSuccess(res, 200, 'Vehicle updated successfully', updatedVehicle);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to update vehicle');
  }
};

export const deleteVehicle = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    await vehicleService.deleteVehicle(req.params.id as string, companyId);
    return sendSuccess(res, 200, 'Vehicle deleted successfully');
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to delete vehicle');
  }
};
