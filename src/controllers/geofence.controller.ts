import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as geofenceService from '../services/geofence.service';
import { sendSuccess, sendError } from '../utils/response';
import { createGeofenceSchema, updateGeofenceSchema } from '../validators/geofence.validator';

export const getGeofences = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const geofences = await geofenceService.getGeofences(companyId, skip, limit);
    return sendSuccess(res, 200, 'Geofences retrieved successfully', { geofences, page, limit });
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to retrieve geofences');
  }
};

export const getGeofence = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const geofence = await geofenceService.getGeofenceById(req.params.id as string, companyId);
    return sendSuccess(res, 200, 'Geofence retrieved successfully', geofence);
  } catch (error: any) {
    return sendError(res, 404, error.message || 'Geofence not found');
  }
};

export const createGeofence = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    
    const { error, value } = createGeofenceSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const newGeofence = await geofenceService.createGeofence(companyId, value);
    return sendSuccess(res, 201, 'Geofence created successfully', newGeofence);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to create geofence');
  }
};

export const updateGeofence = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;

    const { error, value } = updateGeofenceSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const updatedGeofence = await geofenceService.updateGeofence(req.params.id as string, companyId, value);
    return sendSuccess(res, 200, 'Geofence updated successfully', updatedGeofence);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to update geofence');
  }
};

export const deleteGeofence = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    await geofenceService.deleteGeofence(req.params.id as string, companyId);
    return sendSuccess(res, 200, 'Geofence deleted successfully');
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to delete geofence');
  }
};
