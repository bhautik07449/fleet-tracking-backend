import { Router } from 'express';
import * as vehicleController from '../controllers/vehicle.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';

const router = Router();

// Protect all vehicle routes
router.use(authenticate);

// List and View vehicles can be done by MANAGER, COMPANY_OWNER, and DRIVER
router.get('/', authorize(['COMPANY_OWNER', 'MANAGER', 'DRIVER']), vehicleController.getVehicles);
router.get('/:id', authorize(['COMPANY_OWNER', 'MANAGER', 'DRIVER']), vehicleController.getVehicle);
router.get('/:id/history', authorize(['COMPANY_OWNER', 'MANAGER', 'DRIVER']), vehicleController.getVehicleHistory);

// Create, Update, Delete vehicles can only be done by MANAGER and COMPANY_OWNER
router.post('/', authorize(['COMPANY_OWNER', 'MANAGER']), vehicleController.createVehicle);
router.put('/:id', authorize(['COMPANY_OWNER', 'MANAGER']), vehicleController.updateVehicle);
router.delete('/:id', authorize(['COMPANY_OWNER', 'MANAGER']), vehicleController.deleteVehicle);
router.post('/:id/engine', authorize(['COMPANY_OWNER', 'MANAGER']), vehicleController.toggleEngine);

export default router;
