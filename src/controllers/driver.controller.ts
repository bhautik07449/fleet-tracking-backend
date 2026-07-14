import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as driverService from '../services/driver.service';
import { sendSuccess, sendError } from '../utils/response';
import { createDriverSchema, updateDriverSchema } from '../validators/driver.validator';

export const getDrivers = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const drivers = await driverService.getDriversByCompanyId(companyId, skip, limit);
    return sendSuccess(res, 200, 'Drivers retrieved successfully', { drivers, page, limit });
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to retrieve drivers');
  }
};

export const getDriver = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const driver = await driverService.getDriverByIdAndCompanyId(req.params.id, companyId);
    return sendSuccess(res, 200, 'Driver retrieved successfully', driver);
  } catch (error: any) {
    return sendError(res, 404, error.message || 'Driver not found');
  }
};

export const createDriver = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    
    const { error, value } = createDriverSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const newDriver = await driverService.createDriver(companyId, value);
    return sendSuccess(res, 201, 'Driver created successfully', newDriver);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to create driver');
  }
};

export const updateDriver = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;

    const { error, value } = updateDriverSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const updatedDriver = await driverService.updateDriver(req.params.id, companyId, value);
    return sendSuccess(res, 200, 'Driver updated successfully', updatedDriver);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to update driver');
  }
};

export const deleteDriver = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    await driverService.deleteDriver(req.params.id, companyId);
    return sendSuccess(res, 200, 'Driver deleted successfully');
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to delete driver');
  }
};
