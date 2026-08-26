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

/**
 * One participant's video tile.
 *
 * The element is always mounted and hidden with CSS when there is nothing to
 * show. It used to be rendered conditionally on `hasVideo`, which could never
 * become true: the effect that sets it reads `videoRef.current`, and the ref is
 * only attached when the element renders, which only happens once `hasVideo` is
 * true. So the ref was always undefined, the effect always took its else
 * branch, and every tile showed the avatar fallback no matter what -- local
 * camera and screen share alike.
 *
 * Keeping the element mounted also avoids tearing down and re-creating the
 * media element every time a track is added or removed.
 */
const Video = ({ stream, isLocalStream, label }) => {
  const videoRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video) {
      setHasVideo(false);
      if (video) video.srcObject = null;
      return undefined;
    }

    video.srcObject = stream;

    // Autoplay can be refused; a muted element is always allowed to play, and
    // the local tile is muted anyway to avoid feeding audio back.
    const attemptPlay = () => {
      const p = video.play();
      if (p && p.catch) p.catch(() => { /* a user gesture will start it */ });
    };
    video.onloadedmetadata = attemptPlay;
    attemptPlay();

    // A track that exists but is ended or muted should not count as video --
    // otherwise turning the camera off leaves a frozen last frame.
    const liveVideo = () =>
      stream.getVideoTracks().some((t) => t.readyState === "live" && !t.muted);

    const sync = () => setHasVideo(liveVideo());
    sync();

    const tracks = stream.getVideoTracks();
    tracks.forEach((t) => {
      t.addEventListener("mute", sync);
      t.addEventListener("unmute", sync);
      t.addEventListener("ended", sync);
    });
    stream.addEventListener("addtrack", sync);
    stream.addEventListener("removetrack", sync);

    return () => {
      tracks.forEach((t) => {
        t.removeEventListener("mute", sync);
        t.removeEventListener("unmute", sync);
        t.removeEventListener("ended", sync);
      });
      stream.removeEventListener("addtrack", sync);
      stream.removeEventListener("removetrack", sync);
      video.onloadedmetadata = null;
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <MainContainer>
      <VideoEl
        ref={videoRef}
        autoPlay
        muted={isLocalStream}
        playsInline
        disablePictureInPicture
        style={{ display: hasVideo ? "block" : "none" }}
      />
      {!hasVideo && (
        <Fallback>
          <Avatar username={label || (isLocalStream ? "You" : "User")} />
        </Fallback>
      )}
    </MainContainer>
  );
};

export default Video;
