import React from "react";
import { render, screen, act } from "@testing-library/react";
import Video from "./Video";

/**
 * The regression guard for the bug where no video tile ever rendered.
 *
 * The element used to be mounted only when `hasVideo` was true. The effect that
 * sets `hasVideo` reads `videoRef.current`, and the ref is only attached once
 * the element exists. So the ref was always null, the effect always took its
 * early return, and every tile showed the avatar fallback: local camera, remote
 * participant and screen share alike. Nothing about the WebRTC code was wrong.
 *
 * jsdom has no MediaStream, so these fakes carry only the surface Video
 * touches: getVideoTracks, and the events it subscribes to.
 */

const fakeTrack = (over = {}) => {
  const listeners = {};
  return {
    kind: "video",
    readyState: "live",
    muted: false,
    addEventListener: (type, fn) => {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener: (type, fn) => {
      listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
    },
    emit: (type) => (listeners[type] || []).forEach((fn) => fn()),
    ...over,
  };
};

const fakeStream = (tracks = []) => {
  const listeners = {};
  return {
    getVideoTracks: () => tracks,
    getTracks: () => tracks,
    addEventListener: (type, fn) => {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener: (type, fn) => {
      listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
    },
  };
};

const videoEl = (container) => container.querySelector("video");

describe("Video", () => {
  it("mounts the video element even with no stream at all", () => {
    // This is the whole bug in one assertion. If the element is conditional on
    // having video, the ref never attaches and nothing can ever show video.
    const { container } = render(<Video stream={null} label="ada" />);
    expect(videoEl(container)).toBeInTheDocument();
  });

  it("shows the avatar and hides the element when there is nothing to play", () => {
    const { container } = render(<Video stream={null} label="ada" />);
    expect(videoEl(container)).toHaveStyle({ display: "none" });
    expect(screen.getByText(/a/i)).toBeInTheDocument();
  });

  it("shows the video when the stream has a live track", () => {
    const { container } = render(<Video stream={fakeStream([fakeTrack()])} label="ada" />);
    expect(videoEl(container)).toHaveStyle({ display: "block" });
  });

  it("attaches the stream to the element", () => {
    const stream = fakeStream([fakeTrack()]);
    const { container } = render(<Video stream={stream} label="ada" />);
    expect(videoEl(container).srcObject).toBe(stream);
  });

  it("treats an ended track as no video, rather than freezing on the last frame", () => {
    const { container } = render(
      <Video stream={fakeStream([fakeTrack({ readyState: "ended" })])} label="ada" />
    );
    expect(videoEl(container)).toHaveStyle({ display: "none" });
  });

  it("treats a muted track as no video, which is what turning the camera off does", () => {
    const { container } = render(
      <Video stream={fakeStream([fakeTrack({ muted: true })])} label="ada" />
    );
    expect(videoEl(container)).toHaveStyle({ display: "none" });
  });

  it("falls back to the avatar when the camera is switched off mid call", () => {
    const track = fakeTrack();
    const { container } = render(<Video stream={fakeStream([track])} label="ada" />);
    expect(videoEl(container)).toHaveStyle({ display: "block" });

    act(() => {
      track.muted = true;
      track.emit("mute");
    });
    expect(videoEl(container)).toHaveStyle({ display: "none" });
  });

  it("comes back when the camera is switched on again", () => {
    const track = fakeTrack({ muted: true });
    const { container } = render(<Video stream={fakeStream([track])} label="ada" />);
    expect(videoEl(container)).toHaveStyle({ display: "none" });

    act(() => {
      track.muted = false;
      track.emit("unmute");
    });
    expect(videoEl(container)).toHaveStyle({ display: "block" });
  });

  it("mutes the local tile so the call does not feed back into itself", () => {
    const { container } = render(
      <Video stream={fakeStream([fakeTrack()])} isLocalStream label="You" />
    );
    expect(videoEl(container).muted).toBe(true);
  });

  it("does not mute a remote participant", () => {
    const { container } = render(<Video stream={fakeStream([fakeTrack()])} label="grace" />);
    expect(videoEl(container).muted).toBe(false);
  });

  it("clears the element when the stream goes away", () => {
    const { container, rerender } = render(
      <Video stream={fakeStream([fakeTrack()])} label="ada" />
    );
    rerender(<Video stream={null} label="ada" />);
    expect(videoEl(container).srcObject).toBeNull();
    expect(videoEl(container)).toHaveStyle({ display: "none" });
  });

  it("handles an audio only stream, which has no video tracks", () => {
    const { container } = render(<Video stream={fakeStream([])} label="ada" />);
    expect(videoEl(container)).toHaveStyle({ display: "none" });
    expect(videoEl(container)).toBeInTheDocument();
  });
});
