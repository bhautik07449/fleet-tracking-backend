import Joi from 'joi';

export const createGeofenceSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  type: Joi.string().valid('POLYGON', 'CIRCLE').required(),
  coordinates: Joi.any().required(), // Should be array of points or single center point
  radius: Joi.number().min(0).allow(null), // Required if type is CIRCLE
}).custom((value, helpers) => {
  if (value.type === 'CIRCLE' && (value.radius === null || value.radius === undefined)) {
    return helpers.message({ custom: 'Radius is required for CIRCLE geofence' });
  }
  return value;
});

export const updateGeofenceSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  type: Joi.string().valid('POLYGON', 'CIRCLE'),
  coordinates: Joi.any(),
  radius: Joi.number().min(0).allow(null),
});
