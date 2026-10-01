const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/analytics.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// All analytics routes require login
// Employees see own data, Managers see dept, Admins see everything
router.get('/summary',     protect, controller.getSummary);
router.get('/monthly',     protect, controller.getMonthlyTrend);
router.get('/category',    protect, controller.getCategoryBreakdown);
router.get('/departments', protect, restrictTo('ADMIN'), controller.getDepartmentBreakdown);
router.get('/top-spenders',protect, restrictTo('ADMIN', 'MANAGER'), controller.getTopSpenders);

module.exports = router;