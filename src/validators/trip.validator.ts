import Joi from 'joi';

const locationSchema = Joi.object({
  latitude: Joi.number().required(),
  longitude: Joi.number().required(),
  address: Joi.string().allow(null, ''),
});

export const startTripSchema = Joi.object({
  vehicleId: Joi.string().uuid().required(),
  startLocation: locationSchema.required(),
});

export const endTripSchema = Joi.object({
  endLocation: locationSchema.required(),
});
