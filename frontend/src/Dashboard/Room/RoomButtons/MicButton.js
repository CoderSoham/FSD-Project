import React, { useState } from "react";
import IconButton from "@mui/material/IconButton";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";

const MicButton = ({ localStream }) => {
  const [micEnabled, setMicEnabled] = useState(true);

  const handleToggleMic = () => {
    // A stream with no audio track is normal: permission can be refused for the
    // microphone alone, and the room still works. Reading [0].enabled off it
    // threw and took the whole room down with it.
    const track = localStream?.getAudioTracks?.()[0];
    if (!track) return;
    track.enabled = !micEnabled;
    setMicEnabled(!micEnabled);
  };

  const label = micEnabled ? "Mute your microphone" : "Unmute your microphone";

  return (
    <IconButton
      onClick={handleToggleMic}
      style={{ color: "var(--text)" }}
      aria-label={label}
      aria-pressed={!micEnabled}
      title={label}
    >
      {micEnabled ? <MicIcon /> : <MicOffIcon />}
    </IconButton>
  );
};

export default MicButton;
