import React, { useState } from "react";
import { styled } from "@mui/system";
import ResizeRoomButton from "./ResizeRoomButton";
import VideosContainer from "./VideosContainer";
import RoomButtons from "./RoomButtons/RoomButtons";
import RoomChatPanel from "./RoomChatPanel";
import CodeEditorPanel from '../../shared/components/CodeEditorPanel';
import { useSelector } from 'react-redux';

const MainContainer = styled("div")({
  position: "absolute",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "row",
  alignItems: "stretch",
  justifyContent: "center",
  backgroundColor: "var(--surface)",
  boxShadow: "var(--shadow-lg)",
  transition: "background 0.3s, box-shadow 0.3s, border-radius 0.3s"
});

const fullScreenRoomStyle = {
  width: "100%",
  height: "100vh",
};

const minimizedRoomStyle = {
  bottom: "0px",
  right: "0px",
  width: "30%",
  height: "40vh",
};

const Room = () => {
  const [isRoomMinimized, setIsRoomMinimized] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [codeEditorOpen, setCodeEditorOpen] = useState(false);
  const roomDetails = useSelector(state => state.room.roomDetails);
  const [codeValue, setCodeValue] = useState("");
  const [codeLang, setCodeLang] = useState("javascript");

  const roomResizeHandler = () => {
    setIsRoomMinimized(!isRoomMinimized);
  };

  return (
    <MainContainer
      style={isRoomMinimized ? minimizedRoomStyle : fullScreenRoomStyle}
    >
      {/* Collapsible chat panel */}
      {!isRoomMinimized && (
        <RoomChatPanel open={chatOpen} setOpen={setChatOpen} />
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", minHeight: 0, height: '100%' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', height: '100%' }}>
          <VideosContainer />
        </div>
        <RoomButtons />
        <ResizeRoomButton
          isRoomMinimized={isRoomMinimized}
          handleRoomResize={roomResizeHandler}
        />
        {/* Chat toggle button */}
        {!isRoomMinimized && (
          <button
            style={{
              position: "absolute",
              left: chatOpen ? 260 : 0,
              top: 16,
              zIndex: 20,
              background: "var(--surface-sunken)",
              color: "var(--text)",
              border: "none",
              borderRadius: "0 8px 8px 0",
              padding: "8px 12px",
              cursor: "pointer",
              transition: "left 0.2s"
            }}
            onClick={() => setChatOpen((open) => !open)}
            title={chatOpen ? "Hide chat" : "Show chat"}
          >
            {chatOpen ? "←" : "💬"}
          </button>
        )}
        {/* Add a button to open the code editor */}
        {!isRoomMinimized && (
          <button
            style={{
              position: "absolute",
              right: 16,
              top: 16,
              zIndex: 20,
              background: "var(--surface-sunken)",
              color: "var(--text)",
              border: "none",
              borderRadius: "8px",
              padding: "8px 12px",
              cursor: "pointer",
              marginLeft: 8
            }}
            onClick={() => setCodeEditorOpen(true)}
            title="Open collaborative code editor"
          >
            📝 Code
          </button>
        )}
      </div>
      <CodeEditorPanel
        open={codeEditorOpen}
        onClose={() => setCodeEditorOpen(false)}
        language={codeLang}
        setLanguage={setCodeLang}
        value={codeValue}
        onChange={setCodeValue}
        sessionId={roomDetails?.roomId}
      />
    </MainContainer>
  );
};

export default Room;
