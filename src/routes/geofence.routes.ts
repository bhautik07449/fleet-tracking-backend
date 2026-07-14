import { Router } from 'express';
import * as geofenceController from '../controllers/geofence.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';

const router = Router();

// Protect all geofence routes
router.use(authenticate);

// View geofences
router.get('/', authorize(['COMPANY_OWNER', 'MANAGER', 'DRIVER']), geofenceController.getGeofences);
router.get('/:id', authorize(['COMPANY_OWNER', 'MANAGER', 'DRIVER']), geofenceController.getGeofence);

// Manage geofences
router.post('/', authorize(['COMPANY_OWNER', 'MANAGER']), geofenceController.createGeofence);
router.put('/:id', authorize(['COMPANY_OWNER', 'MANAGER']), geofenceController.updateGeofence);
router.delete('/:id', authorize(['COMPANY_OWNER', 'MANAGER']), geofenceController.deleteGeofence);

export default router;
