import { Router } from 'express';
import * as driverController from '../controllers/driver.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';

const router = Router();

// Protect all driver routes
router.use(authenticate);

// List and View drivers can be done by MANAGER, COMPANY_OWNER
router.get('/', authorize(['COMPANY_OWNER', 'MANAGER']), driverController.getDrivers);
router.get('/:id', authorize(['COMPANY_OWNER', 'MANAGER']), driverController.getDriver);

// Create, Update, Delete drivers can be done by MANAGER and COMPANY_OWNER
router.post('/', authorize(['COMPANY_OWNER', 'MANAGER']), driverController.createDriver);
router.put('/:id', authorize(['COMPANY_OWNER', 'MANAGER']), driverController.updateDriver);
router.delete('/:id', authorize(['COMPANY_OWNER', 'MANAGER']), driverController.deleteDriver);

export default router;
