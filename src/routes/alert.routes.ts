import { Router } from 'express';
import * as alertController from '../controllers/alert.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';

const router = Router();

// Protect all alert routes
router.use(authenticate);

// View alerts
router.get('/', authorize(['COMPANY_OWNER', 'MANAGER', 'DRIVER']), alertController.getAlerts);

// Manage alerts
router.post('/', authorize(['COMPANY_OWNER', 'MANAGER']), alertController.createManualAlert);
router.put('/:id/resolve', authorize(['COMPANY_OWNER', 'MANAGER']), alertController.resolveAlert);
router.delete('/:id', authorize(['COMPANY_OWNER', 'MANAGER']), alertController.deleteAlert);

export default router;
