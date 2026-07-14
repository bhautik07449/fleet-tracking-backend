import { Router } from 'express';
import * as tripController from '../controllers/trip.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';

const router = Router();

// Protect all trip routes
router.use(authenticate);

// View trips
router.get('/', authorize(['COMPANY_OWNER', 'MANAGER', 'DRIVER']), tripController.getTrips);
router.get('/ongoing/:vehicleId', authorize(['COMPANY_OWNER', 'MANAGER', 'DRIVER']), tripController.getOngoingTrip);

// Manage trips
router.post('/start', authorize(['COMPANY_OWNER', 'MANAGER', 'DRIVER']), tripController.startTrip);
router.put('/:id/end', authorize(['COMPANY_OWNER', 'MANAGER', 'DRIVER']), tripController.endTrip);

export default router;
