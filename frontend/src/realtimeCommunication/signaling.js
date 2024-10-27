import io from 'socket.io-client';

const socket = io("http://10.20.25.129:5002"); // Your backend URL

export const initializePeerConnection = (localVideo, remoteVideo) => {
  const peerConnection = new RTCPeerConnection();

  // Add local stream
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
      localVideo.srcObject = stream;
      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
    });

  // Handle incoming tracks
  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  // Handle signaling messages
  socket.on('signal', (data) => {
    if (data.offer) {
      peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
        .then(() => peerConnection.createAnswer())
        .then(answer => {
          peerConnection.setLocalDescription(answer);
          socket.emit('signal', { answer });
        });
    }

    if (data.answer) {
      peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });

  return peerConnection;
};

export const startCall = (peerConnection, userId) => {
  // Create an offer and send it to the other user
  peerConnection.createOffer()
    .then(offer => {
      peerConnection.setLocalDescription(offer);
      socket.emit('signal', { offer, userId });
    });
};

export const answerCall = (peerConnection) => {
  // Logic to answer a call (this can be extended as needed)
};
