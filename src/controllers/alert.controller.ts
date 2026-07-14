import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as alertService from '../services/alert.service';
import { sendSuccess, sendError } from '../utils/response';
import { createAlertSchema } from '../validators/alert.validator';

export const getAlerts = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    let isResolved: boolean | undefined = undefined;
    if (req.query.isResolved !== undefined) {
      isResolved = req.query.isResolved === 'true';
    }

    const alerts = await alertService.getAlertsByCompanyId(companyId, skip, limit, isResolved);
    return sendSuccess(res, 200, 'Alerts retrieved successfully', { alerts, page, limit });
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to retrieve alerts');
  }
};

export const createManualAlert = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    
    const { error, value } = createAlertSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const newAlert = await alertService.createSystemAlert(value.vehicleId, companyId, value.type, value.message);
    return sendSuccess(res, 201, 'Alert created successfully', newAlert);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to create alert');
  }
};

export const resolveAlert = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const updatedAlert = await alertService.resolveAlert(req.params.id, companyId);
    return sendSuccess(res, 200, 'Alert resolved successfully', updatedAlert);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to resolve alert');
  }
};

export const deleteAlert = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    await alertService.deleteAlert(req.params.id, companyId);
    return sendSuccess(res, 200, 'Alert deleted successfully');
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to delete alert');
  }
};
