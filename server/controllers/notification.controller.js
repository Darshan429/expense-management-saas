const { Notification } = require("../models/index");
const { Op } = require("sequelize");

// GET /notifications — newest 20 for logged-in user
exports.getAll = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { user_id: req.user.id },
      order: [["created_at", "DESC"]],
      limit: 20,
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// GET /notifications/unread-count — powers the bell badge number
exports.unreadCount = async (req, res) => {
  try {
    const count = await Notification.count({
      where: { user_id: req.user.id, is_read: false },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Failed to get unread count" });
  }
};

// PATCH /notifications/mark-all-read
exports.markAllRead = async (req, res) => {
  try {
    await Notification.update(
      { is_read: true },
      { where: { user_id: req.user.id, is_read: false } },
    );
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
};

// PATCH /notifications/:id/read — mark single notification read
exports.markOneRead = async (req, res) => {
  try {
    await Notification.update(
      { is_read: true },
      {
        where: {
          id: req.params.id,
          user_id: req.user.id, // security: can only mark your own
        },
      },
    );
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
};

