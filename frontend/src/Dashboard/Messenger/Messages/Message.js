import React from "react";
import { styled } from "@mui/system";
import Avatar from "../../../shared/components/Avatar";
import Typography from "@mui/material/Typography";

const MainContainer = styled("div")({
  width: "97%",
  display: "flex",
  marginTop: "10px",
  alignItems: "flex-start",
  transition: "background 0.2s, box-shadow 0.2s"
});

const AvatarContainer = styled("div")({
  width: "48px",
  minWidth: "48px",
  marginRight: "10px"
});

const MessageContainer = styled("div")({
  display: "flex",
  flexDirection: "column",
  background: "var(--surface-sunken)",
  borderRadius: "10px",
  boxShadow: "var(--shadow-sm)",
  padding: "10px 16px 10px 16px",
  transition: "background 0.2s, box-shadow 0.2s",
  position: "relative",
  minWidth: 0,
  maxWidth: "calc(100% - 60px)",
});

const MessageContent = styled("div")({
  color: "var(--text)",
  fontSize: "15px",
  wordBreak: "break-word",
  marginTop: "2px"
});

const SameAuthorMessageContent = styled("div")({
  color: "var(--text)",
  width: "97%",
  marginLeft: "58px",
  background: "var(--surface-sunken)",
  borderRadius: "10px",
  boxShadow: "var(--shadow-sm)",
  padding: "8px 16px",
  fontSize: "15px",
  marginTop: "2px"
});

const SameAuthorMessageText = styled("span")({
  marginLeft: 0,
});

function renderFilePreview(content) {
  if (typeof content !== 'string') return content;
  if (content.match(/\.(jpeg|jpg|png|gif|bmp|webp)$/i)) {
    return <img src={content} alt="uploaded" style={{ maxWidth: 200, borderRadius: 8, marginTop: 4 }} />;
  }
  if (content.match(/\.(mp4|webm|ogg)$/i)) {
    return <video src={content} controls style={{ maxWidth: 240, borderRadius: 8, marginTop: 4 }} />;
  }
  // Legacy messages whose content is a raw `/uploads/<name>` path. That route
  // no longer exists -- it served research documents to anyone holding a
  // filename -- so rendering it as a link would just produce a dead download.
  if (content.startsWith("/uploads/")) {
    const filename = content.split("/").pop();
    return (
      <span style={{ color: "var(--text-muted)", fontStyle: "italic" }} title={filename}>
        {filename} was shared before secure downloads and can no longer be retrieved
      </span>
    );
  }
  return content;
}

const Message = ({ content, sameAuthor, username, date, sameDay }) => {
  if (sameAuthor && sameDay) {
    return (
      <SameAuthorMessageContent>
        <SameAuthorMessageText>{renderFilePreview(content)}</SameAuthorMessageText>
      </SameAuthorMessageContent>
    );
  }

  return (
    <MainContainer>
      <AvatarContainer>
        <Avatar username={username} />
      </AvatarContainer>
      <MessageContainer>
        <Typography style={{ fontSize: "15px", color: "var(--accent)", fontWeight: 600 }}>
          {username} {" "}
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{date}</span>
        </Typography>
        <MessageContent>{renderFilePreview(content)}</MessageContent>
      </MessageContainer>
    </MainContainer>
  );
};

export default Message;
