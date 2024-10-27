import React, { useState } from "react";
import { styled } from "@mui/system";
import RecordRTC, { RecordRTCPromisesHandler } from "recordrtc";
import { saveAs } from "file-saver";

import CameraButton from "./CameraButton";
import MicButton from "./MicButton";
import CloseRoomButton from "./CloseRoomButton";
import ScreenShareButton from "./ScreenShareButton";
import { connect } from "react-redux";
import { getActions } from "../../../store/actions/roomActions";
import store from "../../../store/store";

let VIDEO_BLOB = "";

const MainContainer = styled("div")({
  height: "15%",
  width: "100%",
  backgroundColor: "#5865f2",
  borderTopLeftRadius: "8px",
  borderTopRightRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

const RoomButtons = (props) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState();
  const [stream, setStream] = useState();
  const [videoBlob, setVideoUrlBlob] = useState();
  const [isDownloadable, setIsDownloadable] = useState(false);
  const { localStream, isUserJoinedWithOnlyAudio } = props;

  const handleRecord = async () => {
    setIsRecording(true);
    setIsDownloadable(false);

    const stream = store.getState().room.localStream;
    const recorder = new RecordRTCPromisesHandler(stream, {
      type: "video",
    });

    await recorder.startRecording();
    setRecorder(recorder);
    setStream(stream);
    setVideoUrlBlob(null);
  };

  const handleStopRecord = async () => {
    setIsRecording(false);

    if (recorder) {
      await recorder.stopRecording();
      const blob = await recorder.getBlob();
      stream.stop();
      setVideoUrlBlob(blob);
      VIDEO_BLOB = blob;
      setStream(null);
      setRecorder(null);
      setIsDownloadable(true);
    }
  };

  const downloadVideo = async () => {
    if (videoBlob) {
      const mp4File = new File([videoBlob], "demo.mp4", { type: "video/mp4" });
      saveAs(mp4File, `Video-${Date.now()}.mp4`);
    }
  };

  return (
    <MainContainer>
      {!isUserJoinedWithOnlyAudio && <ScreenShareButton {...props} />}
      <MicButton localStream={localStream} />
      <CloseRoomButton />
      {!isUserJoinedWithOnlyAudio && <CameraButton localStream={localStream} />}
      <button
        style={{
          border: "1px solid #fff",
          background: "inherit",
          color: "white",
          cursor: "pointer",
          borderRadius: "5px",
          padding: "3px",
          marginRight: "10px",
        }}
        onClick={isRecording ? handleStopRecord : handleRecord}
      >
        {isRecording ? "Stop recording" : "Start recording"}
      </button>

      {isDownloadable && (
        <button
          style={{
            border: "1px solid #fff",
            background: "inherit",
            color: "white",
            cursor: "pointer",
            borderRadius: "5px",
            padding: "3px",
            marginRight: "10px",
          }}
          onClick={downloadVideo}
        >
          Download
        </button>
      )}
    </MainContainer>
  );
};

const mapStoreStateToProps = ({ room }) => {
  return {
    ...room,
  };
};

const mapActionsToProps = (dispatch) => {
  return {
    ...getActions(dispatch),
  };
};

export function fetchVideoBlob() {
  return VIDEO_BLOB;
}

export default connect(mapStoreStateToProps, mapActionsToProps)(RoomButtons);
