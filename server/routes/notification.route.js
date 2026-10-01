// server/routes/notification.route.js
const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth.middleware');

// All routes require login
router.get('/',                protect, controller.getAll);
router.get('/unread-count',    protect, controller.unreadCount);
router.patch('/mark-all-read', protect, controller.markAllRead);
router.patch('/:id/read',      protect, controller.markOneRead);

module.exports = router;