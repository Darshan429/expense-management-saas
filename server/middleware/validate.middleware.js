// middleware/validate.middleware.js
const Joi = require('joi');

const createExpenseSchema = Joi.object({
  amount:        Joi.number().positive().max(1000000).required(),
  category:      Joi.string().valid('Travel','Meals','Software','Office','Other').required(),
  description:   Joi.string().max(500).allow('', null),
  department_id: Joi.number().integer().positive().allow(null),
});

exports.validateExpense = (req, res, next) => {
  const { error } = createExpenseSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  next();
};