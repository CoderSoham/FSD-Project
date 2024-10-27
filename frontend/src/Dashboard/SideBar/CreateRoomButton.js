import React, { useState } from "react";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import * as roomHandler from "../../realtimeCommunication/roomHandler";
import VideoCall from "../../realtimeCommunication/VideoCall"; // Adjust the path as needed

const CreateRoomButton = ({ isUserInRoom, userId }) => {
  const [isVideoCallActive, setIsVideoCallActive] = useState(false); // State to track video call status
  const [roomId, setRoomId] = useState(null); // State to hold the room ID

  const createNewRoomHandler = async () => {
    const newRoomId = await roomHandler.createNewRoom(); // Assuming this function returns a new room ID
    setRoomId(newRoomId); // Set the room ID
    setIsVideoCallActive(true); // Start the video call
  };

  return (
    <div>
      <Button
        disabled={isUserInRoom}
        onClick={createNewRoomHandler}
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "16px",
          margin: 0,
          padding: 0,
          minWidth: 0,
          marginTop: "10px",
          color: "white",
          backgroundColor: "#5865F2",
        }}
      >
        <AddIcon />
      </Button>

      {isVideoCallActive && <VideoCall userId={userId} roomId={roomId} />} {/* Render VideoCall when active */}
    </div>
  );
};

export default CreateRoomButton;
