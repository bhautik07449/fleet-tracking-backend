import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as shareService from '../services/share.service';
import { sendSuccess, sendError } from '../utils/response';

export const generateShareLink = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const vehicleId = (req.params.id as string) || req.body.vehicleId;
    const durationHours = parseInt(req.body.durationHours as string) || 2;

    if (!vehicleId) {
      return sendError(res, 400, 'Vehicle ID is required');
    }

    const shareData = await shareService.createShareLink(vehicleId, companyId, durationHours);
    return sendSuccess(res, 201, 'Share tracking link generated successfully', shareData);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to generate share link');
  }
};

export const getSharedVehicle = async (req: Request, res: Response): Promise<any> => {
  try {
    const token = req.params.token as string;
    if (!token) {
      return sendError(res, 400, 'Token is required');
    }

    const data = await shareService.getSharedVehicleByToken(token);
    return sendSuccess(res, 200, 'Shared vehicle retrieved successfully', data);
  } catch (error: any) {
    const status = error.message.includes('expired') ? 410 : 404;
    return sendError(res, status, error.message || 'Failed to retrieve shared vehicle');
  }
};
