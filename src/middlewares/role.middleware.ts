import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { sendError } from '../utils/response';

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return sendError(res, 401, 'Unauthorized: User not found in request');
    }

    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, 'Forbidden: You do not have permission for this action');
    }

    next();
  };
};
