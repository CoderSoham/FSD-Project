import React, { useState } from "react";
import IconButton from "@mui/material/IconButton";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";

const CameraButton = ({ localStream }) => {
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const handleToggleCamera = () => {
    // Same as the microphone: no video track is a state the room can be in, and
    // it used to be a TypeError rather than a no-op.
    const track = localStream?.getVideoTracks?.()[0];
    if (!track) return;
    track.enabled = !cameraEnabled;
    setCameraEnabled(!cameraEnabled);
  };

  const label = cameraEnabled ? "Turn your camera off" : "Turn your camera on";

  return (
    <IconButton
      onClick={handleToggleCamera}
      style={{ color: "var(--text)" }}
      aria-label={label}
      aria-pressed={!cameraEnabled}
      title={label}
    >
      {cameraEnabled ? <VideocamIcon /> : <VideocamOffIcon />}
    </IconButton>
  );
};

export default CameraButton;
