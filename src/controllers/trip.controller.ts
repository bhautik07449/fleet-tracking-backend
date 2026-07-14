import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as tripService from '../services/trip.service';
import { sendSuccess, sendError } from '../utils/response';
import { startTripSchema, endTripSchema } from '../validators/trip.validator';

export const getTrips = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const trips = await tripService.getTripsByCompanyId(companyId, skip, limit);
    return sendSuccess(res, 200, 'Trips retrieved successfully', { trips, page, limit });
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to retrieve trips');
  }
};

export const startTrip = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    
    const { error, value } = startTripSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const newTrip = await tripService.startTrip(value.vehicleId, companyId, value.startLocation);
    return sendSuccess(res, 201, 'Trip started successfully', newTrip);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to start trip');
  }
};

export const endTrip = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;

    const { error, value } = endTripSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const completedTrip = await tripService.endTrip(req.params.id, companyId, value.endLocation);
    return sendSuccess(res, 200, 'Trip ended successfully', completedTrip);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to end trip');
  }
};

export const getOngoingTrip = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const vehicleId = req.params.vehicleId;
    const trip = await tripService.getOngoingTrip(vehicleId, companyId);
    
    if (!trip) {
      return sendSuccess(res, 200, 'No ongoing trip for this vehicle', null);
    }
    
    return sendSuccess(res, 200, 'Ongoing trip retrieved', trip);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to retrieve ongoing trip');
  }
};
