import { Router } from 'express';
import * as maintenanceController from '../controllers/maintenance.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', maintenanceController.getReminders);
router.post('/', maintenanceController.createReminder);
router.put('/:id', maintenanceController.updateReminder);
router.delete('/:id', maintenanceController.deleteReminder);

export default router;
