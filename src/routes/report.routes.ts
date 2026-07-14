import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';

const router = Router();

// Only COMPANY_OWNER and MANAGER can generate reports
router.use(authenticate);
router.use(authorize(['COMPANY_OWNER', 'MANAGER']));

router.get('/trips', reportController.getTripReport);
router.get('/alerts', reportController.getAlertReport);

export default router;
