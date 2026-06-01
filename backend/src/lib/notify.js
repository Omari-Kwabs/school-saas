let io = null;

function init(socketIoServer) {
  io = socketIoServer;
}

/**
 * Emit a real-time event to all connected clients in a school's room.
 * @param {string} school_id
 * @param {string} event  e.g. 'announcement', 'memo', 'payment'
 * @param {object} payload
 */
function notify(school_id, event, payload) {
  if (!io) return;
  io.to(`school:${school_id}`).emit(event, payload);
}

module.exports = { init, notify };
