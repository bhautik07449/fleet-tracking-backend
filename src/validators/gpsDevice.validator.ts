import Joi from 'joi';

export const createGpsDeviceSchema = Joi.object({
  imei: Joi.string().min(10).max(50).required(),
  deviceModel: Joi.string().max(100).allow(null, ''),
  simNumber: Joi.string().max(20).allow(null, ''),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'FAULTY'),
});

export const updateGpsDeviceSchema = Joi.object({
  imei: Joi.string().min(10).max(50),
  deviceModel: Joi.string().max(100).allow(null, ''),
  simNumber: Joi.string().max(20).allow(null, ''),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'FAULTY'),
});
