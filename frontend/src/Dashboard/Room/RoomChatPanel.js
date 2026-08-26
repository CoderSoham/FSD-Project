import React, { useEffect, useRef, useState, useCallback } from "react";
import { styled } from "@mui/system";
import { getRoomMessages, postRoomMessage, downloadRoomFile } from '../../api';
import { notifyError, notifySuccess } from '../../shared/utils/notification';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import Message from "../Messenger/Messages/Message";

const Panel = styled("div")(({ open }) => ({
  width: open ? 260 : 0,
  minWidth: open ? 260 : 0,
  maxWidth: 260,
  background: "#23272a",
  color: "#fff",
  height: "100%",
  transition: "width 0.2s, min-width 0.2s",
  overflow: open ? "auto" : "hidden",
  display: open ? "flex" : "none",
  flexDirection: "column",
  borderRight: "1px solid #36393f",
  zIndex: 30,
}));

const MessagesList = styled("div")({
  flex: 1,
  overflowY: "auto",
  padding: "12px 8px 8px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
});

const InputRow = styled("div")({
  display: "flex",
  alignItems: "center",
  padding: "8px",
  borderTop: "1px solid #36393f",
  background: "#23272a"
});

const Input = styled("input")({
  flex: 1,
  background: "#2f3136",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  padding: "8px 10px",
  marginRight: 8,
});

const IconButton = styled("button")({
  background: "none",
  border: "none",
  color: "#b9bbbe",
  cursor: "pointer",
  fontSize: "22px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginRight: 4,
});

const HiddenInput = styled("input")({
  display: "none"
});

const ProgressBar = styled("div")({
  height: "4px",
  width: "100%",
  background: "var(--color-surface-alt)",
  borderRadius: "2px",
  margin: "4px 0 0 0",
  overflow: "hidden"
});
const ProgressFill = styled("div")(({ percent }) => ({
  height: "100%",
  width: `${percent}%`,
  background: "var(--color-primary)",
  transition: "width 0.2s"
}));

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

const RoomChatPanel = ({ open, setOpen }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef();
  const roomId = window.location.pathname.split("/").pop();
  const user = JSON.parse(localStorage.getItem("user") || '{}');

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const res = await getRoomMessages(roomId);
    if (res.error) {
      notifyError(res.message || "Failed to fetch messages");
    } else {
      setMessages(res);
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    if (!open) return;
    fetchMessages();
    // Optionally, add polling or socket for real-time updates
  }, [open, roomId, fetchMessages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const res = await postRoomMessage(roomId, {
      roomId,
      userId: user?._id,
      username: user?.username,
      content: input,
      type: 'text',
    });
    if (res.error) {
      notifyError(res.message || "Failed to send message");
    } else {
      setInput("");
      fetchMessages();
    }
    setLoading(false);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomId);
    formData.append('userId', user?._id);
    formData.append('username', user?.username);
    try {
      await uploadFileWithProgress(formData, (percent) => setUploadProgress(percent));
      notifySuccess("File uploaded");
      fetchMessages();
    } catch (e) {
      notifyError("File upload failed");
    }
    setLoading(false);
    setUploadProgress(0);
  };

  // Custom upload with progress
  const uploadFileWithProgress = (formData, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new window.XMLHttpRequest();
      xhr.open('POST', `${BACKEND_URL}/api/files/upload`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded * 100) / event.total);
          onProgress(percent);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(xhr.responseText);
        }
      };
      xhr.onerror = () => reject(xhr.responseText);
      xhr.setRequestHeader('Authorization', `Bearer ${user?.token}`);
      xhr.send(formData);
    });
  };

  // Shared files are fetched through the authenticated download route rather
  // than linked directly. A bare href sends no Authorization header, and the
  // old `/uploads/<name>` static path handed the document to anyone with the
  // filename -- which for unpublished research is the whole problem.
  const fileIdFrom = (url) => {
    const m = /\/files\/([0-9a-fA-F]{24})\/download/.exec(url || '');
    return m ? m[1] : null;
  };

  const handleDownload = async (meta) => {
    const id = meta?.fileId || fileIdFrom(meta?.url);
    if (!id) {
      notifyError('This file was shared before secure downloads and can no longer be fetched.');
      return;
    }
    const res = await downloadRoomFile(id, meta.filename);
    if (res.error) notifyError(res.error);
  };

  return (
    <Panel open={open}>
      <div style={{ fontWeight: 600, fontSize: 18, padding: 12, borderBottom: "1px solid #36393f", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Meeting Chat
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" }}>×</button>
      </div>
      {uploadProgress > 0 && uploadProgress < 100 && (
        <ProgressBar><ProgressFill percent={uploadProgress} /></ProgressBar>
      )}
      <MessagesList>
        {loading ? <div>Loading...</div> : messages.map(msg => (
          msg.type === 'file' ? (
            <div key={msg._id} style={{ padding: '6px 12px' }}>
              <span style={{ color: '#8e9297', fontSize: 12, marginRight: 8 }}>
                {msg.username}
              </span>
              <button
                onClick={() => handleDownload(msg.fileMeta)}
                style={{
                  background: 'transparent', border: '1px solid #4f545c', borderRadius: 4,
                  color: '#00b0f4', cursor: 'pointer', padding: '4px 10px', fontSize: 14,
                }}
              >
                {msg.fileMeta?.filename || 'Download file'}
              </button>
            </div>
          ) : (
          <Message
            key={msg._id}
            content={msg.content}
            username={msg.username}
            date={new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            sameAuthor={false}
            sameDay={false}
          />
          )
        ))}
      </MessagesList>
      <InputRow>
        <IconButton onClick={() => fileInputRef.current.click()} title="Attach file">
          <AttachFileIcon />
        </IconButton>
        <HiddenInput type="file" ref={fileInputRef} onChange={handleFileChange} />
        <Input
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          disabled={loading}
        />
        <button
          onClick={handleSend}
          style={{ background: '#5865f2', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontWeight: 600 }}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </InputRow>
    </Panel>
  );
};

export default RoomChatPanel; 