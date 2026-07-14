import Joi from 'joi';

// Alerts are typically created by the system automatically (e.g. overspeed trigger).
// However, we can validate manual creation if needed, and validation for dismissing alerts.

export const createAlertSchema = Joi.object({
  vehicleId: Joi.string().uuid().required(),
  type: Joi.string().valid('OVERSPEED', 'GEOFENCE_ENTER', 'GEOFENCE_EXIT', 'POWER_CUT', 'SOS', 'OTHER').required(),
  message: Joi.string().max(255).required(),
});

export const updateAlertSchema = Joi.object({
  isResolved: Joi.boolean().required(),
});
