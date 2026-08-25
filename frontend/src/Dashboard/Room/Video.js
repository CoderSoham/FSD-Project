import React, { useEffect, useRef, useState } from "react";
import { styled } from "@mui/system";
import Avatar from "../../shared/components/Avatar";

const MainContainer = styled("div")({
  width: "100%",
  height: "100%",
  backgroundColor: "var(--color-surface-alt)",
  borderRadius: "12px",
  boxShadow: "0 2px 12px var(--color-shadow)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  overflow: "hidden",
  transition: "background 0.3s, box-shadow 0.3s, border-radius 0.3s"
});

const VideoEl = styled("video")({
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  borderRadius: "12px",
  background: "#000"
});

const Fallback = styled("div")({
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-surface-alt)",
  color: "var(--color-primary)",
  fontSize: "2.5rem",
  fontWeight: 700,
  borderRadius: "12px"
});

const Video = ({ stream, isLocalStream }) => {
  const videoRef = useRef();
  const [hasVideo, setHasVideo] = useState(false);

  console.log(`[Video.js Render] isLocalStream=${isLocalStream}, stream id: ${stream?.id}`);

  useEffect(() => {
    console.log(`[Video.js useEffect] stream changed. id: ${stream?.id}`);
    const video = videoRef.current;

    const logTracks = (s) => {
      if (!s) {
        console.log('[Video.js logTracks] Stream is null or undefined.');
        return false; // Return false if no stream
      }
      console.log(`[Video.js logTracks] Logging tracks for stream id: ${s.id}`);
      const allTracks = s.getTracks();
      console.log(`[Video.js logTracks] Total tracks: ${allTracks.length}`, allTracks);
      allTracks.forEach((track, i) => {
        console.log(`[Video.js logTracks] Track ${i}: kind=${track.kind}, enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}, id=${track.id}`);
      });
      const videoTracks = s.getVideoTracks();
      console.log(`[Video.js logTracks] Video tracks count: ${videoTracks.length}`, videoTracks);
      return videoTracks.length > 0;
    };

    if (stream && video) {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        console.log(`[Video.js] onloadedmetadata for stream id: ${stream.id}`);
        video.play().catch(err => console.error('[Video.js] video.play() failed', err));
      };
      
      video.onerror = () => {
        console.error(`[Video.js] Video error for stream id: ${stream.id}`, video.error);
      };

      const hasVideoTracks = logTracks(stream);
      setHasVideo(hasVideoTracks);

      const handleTracksChanged = () => {
        console.log(`[Video.js handleTracksChanged] 'addtrack' or 'removetrack' event fired for stream id: ${stream.id}`);
        const newHasVideo = logTracks(stream);
        setHasVideo(newHasVideo);
      };

      stream.addEventListener('addtrack', handleTracksChanged);
      stream.addEventListener('removetrack', handleTracksChanged);

      return () => {
        console.log(`[Video.js cleanup] Cleaning up for stream id: ${stream?.id}`);
        if (video) {
          video.srcObject = null;
          video.onloadedmetadata = null;
          video.onerror = null;
        }
        stream.removeEventListener('addtrack', handleTracksChanged);
        stream.removeEventListener('removetrack', handleTracksChanged);
      };
    } else {
      console.log('[Video.js useEffect] No stream or video ref. Cleaning up.');
      setHasVideo(false);
      if (video) video.srcObject = null;
    }
  }, [stream]);

  return (
    <MainContainer>
      {console.log(`[Video.js Render return] hasVideo=${hasVideo}, stream id: ${stream?.id}`)}
      {hasVideo ? (
        <VideoEl
          ref={videoRef}
          autoPlay
          muted={isLocalStream}
          playsInline
          disablePictureInPicture
        />
      ) : (
        <Fallback>
          <Avatar username={isLocalStream ? "You" : "User"} />
        </Fallback>
      )}
    </MainContainer>
  );
};

export default Video;
