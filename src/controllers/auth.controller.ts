import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/auth.validator';

export const register = async (req: Request, res: Response): Promise<any> => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const data = await authService.registerCompanyAndOwner(value);
    return sendSuccess(res, 201, 'Registration successful', data);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Registration failed');
  }
};

export const login = async (req: Request, res: Response): Promise<any> => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const data = await authService.loginUser(value);
    return sendSuccess(res, 200, 'Login successful', data);
  } catch (error: any) {
    return sendError(res, 401, error.message || 'Login failed');
  }
};

export const refresh = async (req: Request, res: Response): Promise<any> => {
  try {
    const { error, value } = refreshTokenSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const tokens = await authService.refreshToken(value.refreshToken);
    return sendSuccess(res, 200, 'Token refreshed successfully', tokens);
  } catch (error: any) {
    return sendError(res, 401, error.message || 'Token refresh failed');
  }
};
