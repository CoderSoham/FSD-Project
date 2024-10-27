const roomSignalingDataHandler = (socket, data) => {
  const { roomId, signalingData } = data;

  // Forward signaling data to all peers in the room
  socket.to(roomId).emit("signaling-data", {
    signalingData,
    senderId: socket.id,
  });
};

module.exports = roomSignalingDataHandler;
