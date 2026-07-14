import { Router } from 'express';
import * as gpsDeviceController from '../controllers/gpsDevice.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';

const router = Router();

// Protect all GPS device routes
router.use(authenticate);

// Listing and Viewing devices can be done by MANAGER and COMPANY_OWNER
router.get('/', authorize(['COMPANY_OWNER', 'MANAGER']), gpsDeviceController.getDevices);
router.get('/:id', authorize(['COMPANY_OWNER', 'MANAGER']), gpsDeviceController.getDevice);

// Creation, Updating, Deletion can be done by MANAGER and COMPANY_OWNER
router.post('/', authorize(['COMPANY_OWNER', 'MANAGER']), gpsDeviceController.createDevice);
router.put('/:id', authorize(['COMPANY_OWNER', 'MANAGER']), gpsDeviceController.updateDevice);
router.delete('/:id', authorize(['COMPANY_OWNER', 'MANAGER']), gpsDeviceController.deleteDevice);

export default router;
