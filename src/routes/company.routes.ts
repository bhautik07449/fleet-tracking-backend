import { Router } from 'express';
import * as companyController from '../controllers/company.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';

const router = Router();

// Protect all company routes
router.use(authenticate);

// Only COMPANY_OWNER and SUPER_ADMIN can manage the company
router.get('/me', authorize(['COMPANY_OWNER', 'SUPER_ADMIN']), companyController.getMyCompany);
router.put('/me', authorize(['COMPANY_OWNER', 'SUPER_ADMIN']), companyController.updateMyCompany);

export default router;
