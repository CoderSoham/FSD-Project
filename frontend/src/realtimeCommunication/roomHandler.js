import store from "../store/store";
import {
  setOpenRoom,
  setRoomDetails,
  setActiveRooms,
  setRemoteStreams,
  setScreenSharingStream,
  setIsUserJoinedOnlyWithAudio,
} from "../store/actions/roomActions";
import * as socketConnection from "./socketConnection";
import * as webRTCHandler from "./webRTCHandler";


export const createNewRoom = () => {
  const successCalbackFunc = () => {
    store.dispatch(setOpenRoom(true, true));

    const audioOnly = store.getState().room.audioOnly;
    store.dispatch(setIsUserJoinedOnlyWithAudio(audioOnly));

    // Emit a socket event to create a new room
    socketConnection.createNewRoom(); // Ensure your socketConnection is set up to handle this
  };

  const audioOnly = store.getState().room.audioOnly;
  webRTCHandler.getLocalStreamPreview(audioOnly, successCalbackFunc);
};

export const newRoomCreated = (data) => {
  const { roomDetails } = data;
  store.dispatch(setRoomDetails(roomDetails));
};

export const updateActiveRooms = (data) => {
  const { activeRooms } = data;

  const friends = store.getState().friends.friends;
  const rooms = [];

  const userId = store.getState().auth.userDetails?._id;

  activeRooms.forEach((room) => {
    const isRoomCreatedByMe = room.roomCreator.userId === userId;

    if (isRoomCreatedByMe) {
      rooms.push({ ...room, creatorUsername: "Me" });
    } else {
      friends.forEach((f) => {
        if (f.id === room.roomCreator.userId) {
          rooms.push({ ...room, creatorUsername: f.username });
        }
      });
    }
  });

  store.dispatch(setActiveRooms(rooms));
};

export const joinRoom = (roomId) => {
  const successCalbackFunc = () => {
    store.dispatch(setRoomDetails({ roomId }));
    store.dispatch(setOpenRoom(false, true));
    const audioOnly = store.getState().room.audioOnly;
    store.dispatch(setIsUserJoinedOnlyWithAudio(audioOnly));
    socketConnection.joinRoom({ roomId });
  };

  const audioOnly = store.getState().room.audioOnly;
  webRTCHandler.getLocalStreamPreview(audioOnly, successCalbackFunc);
};

export const leaveRoom = () => {
  try {
    const roomId = store.getState().room.roomDetails?.roomId;

    // Stop and cleanup local stream
    webRTCHandler.stopLocalStream();

    const screenSharingStream = store.getState().room.screenSharingStream;
    if (screenSharingStream && screenSharingStream.getTracks) {
      screenSharingStream.getTracks().forEach((track) => {
        try { track.stop(); } catch (e) {}
      });
      store.dispatch(setScreenSharingStream(null));
    }

    store.dispatch(setRemoteStreams([]));
    if (webRTCHandler && webRTCHandler.closeAllConnections) {
      try { webRTCHandler.closeAllConnections(); } catch (e) {}
    }

    if (socketConnection && socketConnection.leaveRoom && roomId) {
      try { socketConnection.leaveRoom({ roomId }); } catch (e) {}
    }
    store.dispatch(setRoomDetails(null));
    store.dispatch(setOpenRoom(false, false));
  } catch (err) {
    // Optionally log error
    console.error('Error during leaveRoom cleanup:', err);
  }
};
