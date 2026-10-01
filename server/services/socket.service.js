// Singleton — holds the io instance so any controller can emit
// without needing io passed as a parameter

let _io = null;

module.exports = {
  init(io) {
    _io = io;
  },

  getIO() {
    if (!_io) throw new Error('Socket.io not initialised — call init(io) first');
    return _io;
  },

  // Emit to one specific user's private room
  emitToUser(userId, event, data) {
    if (!_io) return;
    _io.to(`user_${userId}`).emit(event, data);
  }
};