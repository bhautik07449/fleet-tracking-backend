import Joi from 'joi';

export const createVehicleSchema = Joi.object({
  vehicleNumber: Joi.string().min(2).max(50).required(),
  type: Joi.string().max(50).allow(null, ''),
  model: Joi.string().max(100).allow(null, ''),
  driverId: Joi.string().uuid().allow(null, ''),
  gpsDeviceId: Joi.string().uuid().allow(null, ''),
});

export const updateVehicleSchema = Joi.object({
  vehicleNumber: Joi.string().min(2).max(50),
  type: Joi.string().max(50).allow(null, ''),
  model: Joi.string().max(100).allow(null, ''),
  driverId: Joi.string().uuid().allow(null, ''),
  gpsDeviceId: Joi.string().uuid().allow(null, ''),
  status: Joi.string().valid('RUNNING', 'STOPPED', 'OFFLINE'),
});
