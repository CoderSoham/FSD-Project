import React, { useEffect, useRef } from "react";
import { styled } from "@mui/system";
import { fetchVideoBlob } from "./RoomButtons/RoomButtons";

const MainContainer = styled("div")({
  height: "50%",
  width: "50%",
  backgroundColor: "black",
  borderRadius: "8px",
});

const VideoEl = styled("video")({
  width: "100%",
  height: "100%",
});

const Video = ({ stream, isLocalStream }) => {
  const videoRef = useRef();

  useEffect(() => {
    const video = videoRef.current;
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      video.play();
    };
  }, [stream]);

  console.log(fetchVideoBlob());

  return (
    <MainContainer>
      <VideoEl
        ref={videoRef}
        autoPlay
        muted={isLocalStream ? true : false}
        src={
          fetchVideoBlob() ? window.URL.createObjectURL(fetchVideoBlob()) : ""
        }
      />
    </MainContainer>
  );
};

export default Video;
