import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as dashboardService from '../services/dashboard.service';
import { sendSuccess, sendError } from '../utils/response';

export const getMetrics = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const metrics = await dashboardService.getDashboardMetrics(companyId);
    return sendSuccess(res, 200, 'Dashboard metrics retrieved successfully', metrics);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to retrieve dashboard metrics');
  }
};
