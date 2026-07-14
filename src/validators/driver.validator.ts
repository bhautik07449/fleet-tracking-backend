import Joi from 'joi';

export const createDriverSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  licenseNumber: Joi.string().min(2).max(50).required(),
  contactInfo: Joi.string().max(255).allow(null, ''),
});

export const updateDriverSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  licenseNumber: Joi.string().min(2).max(50),
  contactInfo: Joi.string().max(255).allow(null, ''),
});
