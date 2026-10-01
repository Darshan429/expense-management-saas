const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/admin.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// All admin routes — ADMIN only
const adminOnly = [protect, restrictTo('ADMIN')];
// ── User Management ──────────────────────────────────────────────────────────
router.get('/users',                    ...adminOnly, controller.getAllUsers);
router.get('/users/:id',               ...adminOnly, controller.getUserById);
router.patch('/users/:id/role',        ...adminOnly, controller.changeUserRole);
router.patch('/users/:id/department',  ...adminOnly, controller.assignDepartment);
router.patch('/users/:id/activate',    ...adminOnly, controller.activateUser);
router.patch('/users/:id/deactivate',  ...adminOnly, controller.deactivateUser);
router.patch('/users/:id/manager',     ...adminOnly, controller.assignManager);
router.delete('/users/:id',            ...adminOnly, controller.deleteUser);

// ── Department Management ────────────────────────────────────────────────────
router.get('/departments',             ...adminOnly, controller.getAllDepartments);
router.post('/departments',            ...adminOnly, controller.createDepartment);
router.patch('/departments/:id',       ...adminOnly, controller.updateDepartment);
router.delete('/departments/:id',      ...adminOnly, controller.deleteDepartment);

// ── System Overview ──────────────────────────────────────────────────────────
router.get('/overview',                ...adminOnly, controller.getSystemOverview);
router.get('/audit-log',               ...adminOnly, controller.getAuditLog);

module.exports = router;