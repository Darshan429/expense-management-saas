const { Notification } = require('../models/index');
const socketService    = require('./socket.service');

/**
 * Creates a DB row first (guaranteed delivery)
 * then attempts real-time socket emit (best effort)
 *
 * If user is offline → socket emit is a no-op, DB row waits for them
 * If user is online  → they see the toast instantly AND DB row exists
 */
const notify = async  ({ userId, type, title, message, expenseId = null }) => {
  try {
    // 1. Always write to DB first — this is the guarantee
    const notif = await Notification.create({
      user_id:    userId,
      type,
      title,
      message,
      expense_id: expenseId,
      is_read:    false
    });

    // 2. Attempt real-time delivery — fails silently if user offline
    socketService.emitToUser(userId, 'new_notification', {
      id:         notif.id,
      type:       notif.type,
      title:      notif.title,
      message:    notif.message,
      expense_id: notif.expense_id,
      is_read:    false,
      created_at: notif.created_at
    });
    return notif;
  } catch (err) {
    // Never let notification failure crash the approval flow
    console.error('Notification service error:', err.message);
  }
};

module.exports = { notify };