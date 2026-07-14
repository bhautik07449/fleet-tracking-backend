import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as userService from '../services/user.service';
import { sendSuccess, sendError } from '../utils/response';
import { createUserSchema, updateUserSchema } from '../validators/user.validator';

export const getUsers = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const users = await userService.getUsers(companyId, skip, limit);
    return sendSuccess(res, 200, 'Users retrieved successfully', { users, page, limit });
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to retrieve users');
  }
};

export const getUser = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    const user = await userService.getUserById(req.params.id as string, companyId);
    return sendSuccess(res, 200, 'User retrieved successfully', user);
  } catch (error: any) {
    return sendError(res, 404, error.message || 'User not found');
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    
    const { error, value } = createUserSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const newUser = await userService.createUser(companyId, value);
    return sendSuccess(res, 201, 'User created successfully', newUser);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to create user');
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;

    const { error, value } = updateUserSchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const updatedUser = await userService.updateUser(req.params.id as string, companyId, value);
    return sendSuccess(res, 200, 'User updated successfully', updatedUser);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to update user');
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    
    if (req.params.id as string === req.user.userId) {
      return sendError(res, 400, 'You cannot delete yourself');
    }

    await userService.deleteUser(req.params.id as string, companyId);
    return sendSuccess(res, 200, 'User deleted successfully');
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to delete user');
  }
};
