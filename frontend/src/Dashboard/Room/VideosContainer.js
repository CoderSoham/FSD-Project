import React from "react";
import { styled } from "@mui/system";
import { connect } from "react-redux";
import Video from "./Video";

const MainContainer = styled("div")(({ streamCount }) => ({
  flex: 1,
  width: "100%",
  height: "100%",
  display: streamCount === 1 ? "flex" : "grid",
  flexDirection: streamCount === 1 ? "row" : undefined,
  alignItems: "center",
  justifyContent: "center",
  gap: streamCount === 1 ? 0 : "18px",
  padding: streamCount === 1 ? 0 : "18px 12px 12px 12px",
  background: "var(--color-surface)",
  borderRadius: "12px",
  boxShadow: "0 2px 12px var(--color-shadow)",
  transition: "background 0.3s, box-shadow 0.3s",
  ...(streamCount > 1 && {
    gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))`,
    gridAutoRows: "minmax(180px, 1fr)",
    justifyItems: "center"
  })
}));

const VideosContainer = ({
  localStream,
  remoteStreams,
  screenSharingStream,
}) => {
  // Compose all streams to show
  const streams = [
    ...(screenSharingStream ? [screenSharingStream] : [localStream]),
    ...remoteStreams
  ].filter(Boolean);

  console.log('VideosContainer localStream:', localStream);
  console.log('VideosContainer streams:', streams);
  if (streams.length > 0) {
    console.log('First stream tracks:', streams[0].getTracks());
  }

  return (
    <MainContainer streamCount={streams.length}>
      {streams.filter(stream => stream && (stream.getVideoTracks().length > 0 || stream.getAudioTracks().length > 0)).map((stream, idx) => (
        <div
          key={stream.id || idx}
          style={streams.length === 1
            ? { width: '100%', height: '100%', flex: 1, display: 'flex' }
            : { minWidth: 220, minHeight: 160, maxWidth: 480, maxHeight: 360, flex: 1, display: 'flex' }
          }
        >
          <Video
            stream={stream}
            isLocalStream={idx === 0 && !screenSharingStream}
          />
        </div>
      ))}
    </MainContainer>
  );
};

const mapStoreStateToProps = ({ room }) => {
  return {
    ...room,
  };
};

export default connect(mapStoreStateToProps)(VideosContainer);
