import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import * as companyService from '../services/company.service';
import { sendSuccess, sendError } from '../utils/response';
import { updateCompanySchema } from '../validators/company.validator';

export const getMyCompany = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return sendError(res, 400, 'User is not associated with any company');
    }

    const company = await companyService.getCompanyById(companyId);
    return sendSuccess(res, 200, 'Company retrieved successfully', company);
  } catch (error: any) {
    return sendError(res, 404, error.message || 'Company not found');
  }
};

export const updateMyCompany = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return sendError(res, 400, 'User is not associated with any company');
    }

    const { error, value } = updateCompanySchema.validate(req.body);
    if (error) {
      return sendError(res, 400, error.details[0].message);
    }

    const updatedCompany = await companyService.updateCompany(companyId, value);
    return sendSuccess(res, 200, 'Company updated successfully', updatedCompany);
  } catch (error: any) {
    return sendError(res, 400, error.message || 'Failed to update company');
  }
};
