import "@testing-library/jest-dom";

/**
 * jsdom has no layout engine and no media stack, so a handful of browser APIs
 * the app relies on simply do not exist. Stubbing them here rather than in each
 * test keeps the tests about behaviour instead of about jsdom.
 */

// Monaco and react-rnd both measure elements on mount.
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom implements neither of these on HTMLMediaElement, and Video calls play()
// as soon as it is handed a stream.
Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
  configurable: true,
  value: () => Promise.resolve(),
});
Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value: () => {},
});
