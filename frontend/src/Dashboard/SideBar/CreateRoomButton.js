import React from "react";
import Button from "@mui/material/Button";
import AddIcon from "@mui/icons-material/Add";
import * as roomHandler from "../../realtimeCommunication/roomHandler";

const CreateRoomButton = ({ isUserInRoom, userId }) => {

  const createNewRoomHandler = async () => {
    // createNewRoom drives the room through redux; there is nothing to hold here.
    await roomHandler.createNewRoom();
  };

  return (
    <div>
      <Button
        disabled={isUserInRoom}
        onClick={createNewRoomHandler}
        aria-label="Create a room"
        title="Create a room"
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "16px",
          margin: 0,
          padding: 0,
          minWidth: 0,
          marginTop: "10px",
          color: "var(--text)",
          backgroundColor: "var(--accent)",
        }}
      >
        <AddIcon />
      </Button>
    </div>
  );
};

export default CreateRoomButton;
