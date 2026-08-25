import React, { useState, useRef } from "react";
import { styled } from "@mui/system";
import { connect } from "react-redux";
import { sendDirectMessage } from "../../realtimeCommunication/socketConnection";
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { uploadFile } from '../../api';
import { notifySuccess, notifyError } from '../../shared/utils/notification';

const MainContainer = styled("div")({
  height: "60px",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative"
});

const Input = styled("input")({
  backgroundColor: "#2f3136",
  width: "98%",
  height: "44px",
  color: "white",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  padding: "0 10px",
});

const IconButton = styled("button")({
  background: "none",
  border: "none",
  color: "#b9bbbe",
  cursor: "pointer",
  marginRight: "8px",
  fontSize: "22px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative"
});

const Menu = styled("div")({
  position: "absolute",
  bottom: "60px",
  left: "10px",
  background: "#23272a",
  borderRadius: "8px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  padding: "8px 0",
  zIndex: 10,
  minWidth: "140px"
});

const MenuItem = styled("div")({
  color: "#fff",
  padding: "8px 16px",
  cursor: "pointer",
  ':hover': {
    background: "#36393f"
  }
});

const HiddenInput = styled("input")({
  display: "none"
});

const NewMessageInput = ({ chosenChatDetails }) => {
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef();
  const photoInputRef = useRef();

  const handleMessageValueChange = (event) => {
    setMessage(event.target.value);
  };

  const handleKeyPressed = (event) => {
    if (event.key === "Enter") {
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    if (message.length > 0) {
      sendDirectMessage({
        receiverUserId: chosenChatDetails.id,
        content: message,
      });
      setMessage("");
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const response = await uploadFile(file);
    if (response.error) {
      notifyError("File upload failed");
    } else {
      notifySuccess("File uploaded");
      // Optionally, send a message with the file URL
      sendDirectMessage({
        receiverUserId: chosenChatDetails.id,
        content: response.data.url,
        file: {
          name: response.data.originalname,
          url: response.data.url,
          type: response.data.mimetype
        }
      });
    }
  };

  return (
    <MainContainer>
      <IconButton onClick={() => setMenuOpen((open) => !open)} title="Attach">
        <AttachFileIcon />
        {menuOpen && (
          <Menu>
            <MenuItem onClick={() => { setMenuOpen(false); photoInputRef.current.click(); }}>Photo/Video</MenuItem>
            <MenuItem onClick={() => { setMenuOpen(false); fileInputRef.current.click(); }}>Files</MenuItem>
          </Menu>
        )}
      </IconButton>
      <HiddenInput
        type="file"
        accept="image/*,video/*"
        ref={photoInputRef}
        onChange={handleFileChange}
      />
      <HiddenInput
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <Input
        placeholder={`Write message to ${chosenChatDetails.name}`}
        value={message}
        onChange={handleMessageValueChange}
        onKeyDown={handleKeyPressed}
      />
    </MainContainer>
  );
};

const mapStoreStateToProps = ({ chat }) => {
  return {
    ...chat,
  };
};

export default connect(mapStoreStateToProps)(NewMessageInput);
