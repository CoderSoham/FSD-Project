import React, { useEffect, useRef } from "react";
import { initializePeerConnection, startCall, answerCall } from "./signaling";
import "./videoCall.css"; // Import your CSS for styling

const VideoCall = ({ userId }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  useEffect(() => {
    const peerConnection = initializePeerConnection(localVideoRef.current, remoteVideoRef.current);
    peerConnectionRef.current = peerConnection;

    return () => {
      peerConnection.close();
    };
  }, [userId]);

  return (
    <div className="video-call-container">
      <video ref={localVideoRef} autoPlay muted className="local-video" />
      <video ref={remoteVideoRef} autoPlay className="remote-video" />
    </div>
  );
};

export default VideoCall;
