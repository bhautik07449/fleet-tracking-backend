import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as maintenanceService from '../services/maintenance.service';
import { sendSuccess, sendError } from '../utils/response';

export const getReminders = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const vehicleId = req.query.vehicleId as string;
    const items = await maintenanceService.getReminders(companyId, vehicleId);
    return sendSuccess(res, 200, 'Maintenance reminders retrieved successfully', items);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to fetch reminders');
  }
};

export const createReminder = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    if (!req.body.vehicleId || !req.body.title) {
      return sendError(res, 400, 'Vehicle ID and Title are required');
    }
    const created = await maintenanceService.createReminder(req.body, companyId);
    return sendSuccess(res, 201, 'Maintenance reminder created successfully', created);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to create reminder');
  }
};

export const updateReminder = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const id = req.params.id as string;
    const updated = await maintenanceService.updateReminder(id, companyId, req.body);
    return sendSuccess(res, 200, 'Maintenance reminder updated successfully', updated);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to update reminder');
  }
};

export const deleteReminder = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const id = req.params.id as string;
    await maintenanceService.deleteReminder(id, companyId);
    return sendSuccess(res, 200, 'Maintenance reminder deleted successfully', { id });
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to delete reminder');
  }
};
