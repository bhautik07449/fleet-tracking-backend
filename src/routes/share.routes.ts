import { Router } from 'express';
import * as shareController from '../controllers/share.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Public endpoint (No JWT required) for checking live vehicle status via token
router.get('/:token', shareController.getSharedVehicle);

// Protected endpoint for creating a share link for a specific vehicle
router.post('/generate', authenticate, shareController.generateShareLink);
router.post('/vehicle/:id', authenticate, shareController.generateShareLink);

export default router;
