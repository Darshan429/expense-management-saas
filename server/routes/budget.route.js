const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/budget.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// Admin only — create and update budgets
router.post('/',     protect, restrictTo('ADMIN'), controller.createBudget);
router.patch('/:id', protect, restrictTo('ADMIN'), controller.updateBudget);

// Admin and Manager can view budgets
router.get('/',      protect, restrictTo('ADMIN', 'MANAGER'), controller.getBudgets);
router.get('/:id',   protect, restrictTo('ADMIN', 'MANAGER'), controller.getBudgetById);

module.exports = router;