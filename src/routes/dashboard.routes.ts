import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';

const router = Router();

// Protect dashboard routes
router.use(authenticate);

// View metrics
router.get('/', authorize(['COMPANY_OWNER', 'MANAGER', 'DRIVER']), dashboardController.getMetrics);

export default router;
