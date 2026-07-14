import Joi from 'joi';

export const updateCompanySchema = Joi.object({
  name: Joi.string().min(2).max(100),
  address: Joi.string().max(255).allow(null, ''),
  phone: Joi.string().max(20).allow(null, ''),
  settings: Joi.object(),
});
