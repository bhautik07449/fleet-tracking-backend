import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as reportService from '../services/report.service';
import { sendSuccess, sendError } from '../utils/response';

export const getTripReport = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate, vehicleId } = req.query;

    if (!startDate || !endDate) {
      return sendError(res, 400, 'startDate and endDate are required query parameters (ISO strings)');
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return sendError(res, 400, 'Invalid date format');
    }

    const report = await reportService.getTripReport(companyId, start, end, vehicleId as string);
    return sendSuccess(res, 200, 'Trip report generated', report);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to generate trip report');
  }
};

export const getAlertReport = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const { startDate, endDate, vehicleId } = req.query;

    if (!startDate || !endDate) {
      return sendError(res, 400, 'startDate and endDate are required query parameters (ISO strings)');
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return sendError(res, 400, 'Invalid date format');
    }

    const report = await reportService.getAlertReport(companyId, start, end, vehicleId as string);
    return sendSuccess(res, 200, 'Alert report generated', report);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to generate alert report');
  }
};
