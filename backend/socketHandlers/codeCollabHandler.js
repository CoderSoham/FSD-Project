let codeSessions = {}; // { sessionId: { code: '', users: Set() } }

module.exports = (io) => {
  io.on('connection', (socket) => {
    socket.on('joinCodeSession', ({ sessionId, user }) => {
      socket.join(sessionId);
      if (!codeSessions[sessionId]) codeSessions[sessionId] = { code: '', users: new Set() };
      codeSessions[sessionId].users.add(socket.id);
      socket.emit('initCode', { code: codeSessions[sessionId].code });
    });

    socket.on('codeChange', ({ sessionId, code }) => {
      if (!codeSessions[sessionId]) codeSessions[sessionId] = { code: '', users: new Set() };
      codeSessions[sessionId].code = code;
      socket.to(sessionId).emit('codeChange', { code });
    });

    socket.on('cursorChange', ({ sessionId, cursor, user }) => {
      socket.to(sessionId).emit('cursorChange', { cursor, user, socketId: socket.id });
    });

    socket.on('leaveCodeSession', ({ sessionId }) => {
      socket.leave(sessionId);
      if (codeSessions[sessionId]) codeSessions[sessionId].users.delete(socket.id);
    });

    socket.on('disconnect', () => {
      Object.values(codeSessions).forEach(session => session.users.delete(socket.id));
    });
  });
}; 