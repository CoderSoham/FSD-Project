const { test, expect } = require("@playwright/test");
const { signIn } = require("./helpers");

/**
 * Video tiles, with a real MediaStream.
 *
 * Chromium is launched with a fake camera and microphone that always exist and
 * never prompt, so getUserMedia resolves with genuinely live tracks. That is
 * the thing that could not be faked in a unit test and the thing that was
 * broken: every tile rendered the avatar fallback, because the video element
 * was mounted only once hasVideo was true and hasVideo could only become true
 * once the element existed.
 *
 * The peer to peer half needs two people to actually connect through the
 * signalling server, which is its own project. What is checked here is the
 * local half: acquiring a stream, painting it, and swapping it for a screen
 * share.
 */

/** Create a room and wait for the local tile to have a stream attached. */
async function openRoom(page) {
  await page.getByRole("button", { name: "Create a room" }).click();
  await page.waitForSelector("video", { timeout: 20_000 });
  await page.waitForFunction(
    () => {
      const v = document.querySelector("video");
      return v && v.srcObject && v.srcObject.getVideoTracks().length > 0;
    },
    { timeout: 20_000 }
  );
}

test("creating a room paints your own camera rather than the avatar", async ({ page }) => {
  await signIn(page, "ada");
  await openRoom(page);

  const tile = page.locator("video").first();
  await expect(tile).toBeVisible();

  // Visible is not enough. The element could be showing a black rectangle with
  // no track, which is exactly what the bug looked like from the outside.
  const state = await page.evaluate(() => {
    const v = document.querySelector("video");
    const track = v.srcObject.getVideoTracks()[0];
    return {
      display: getComputedStyle(v).display,
      readyState: track.readyState,
      muted: track.muted,
      width: v.getBoundingClientRect().width,
    };
  });

  expect(state.readyState).toBe("live");
  expect(state.muted).toBe(false);
  expect(state.display).toBe("block");
  expect(state.width).toBeGreaterThan(50);
});

test("your own tile is muted, so the call does not feed back into itself", async ({ page }) => {
  await signIn(page, "ada");
  await openRoom(page);
  const muted = await page.evaluate(() => document.querySelector("video").muted);
  expect(muted).toBe(true);
});

test("the camera button turns the track off and back on", async ({ page }) => {
  await signIn(page, "ada");
  await openRoom(page);

  const enabled = () =>
    page.evaluate(() => document.querySelector("video").srcObject.getVideoTracks()[0].enabled);

  expect(await enabled()).toBe(true);

  await page.getByRole("button", { name: "Turn your camera off" }).click();
  expect(await enabled()).toBe(false);

  // The label follows the state, which is the only way someone using a screen
  // reader can tell what the button will do.
  await page.getByRole("button", { name: "Turn your camera on" }).click();
  expect(await enabled()).toBe(true);
});

test("the microphone button toggles the audio track, not the video one", async ({ page }) => {
  await signIn(page, "ada");
  await openRoom(page);

  const tracks = () =>
    page.evaluate(() => {
      const s = document.querySelector("video").srcObject;
      return {
        audio: s.getAudioTracks()[0]?.enabled,
        video: s.getVideoTracks()[0]?.enabled,
      };
    });

  expect(await tracks()).toEqual({ audio: true, video: true });
  await page.getByRole("button", { name: "Mute your microphone" }).click();
  expect(await tracks()).toEqual({ audio: false, video: true });
});

test("every control in the room says what it does", async ({ page }) => {
  // They are all icons. Without a name they are announced as "button", which
  // makes the room unusable without sight, and unlabelled in every test.
  await signIn(page, "ada");
  await openRoom(page);

  for (const name of [
    "Share your screen",
    "Mute your microphone",
    "Leave the room",
    "Turn your camera off",
  ]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
});

test("a room with one person shows exactly one tile", async ({ page }) => {
  await signIn(page, "ada");
  await openRoom(page);
  await expect(page.locator("video")).toHaveCount(1);
});

test("leaving the room releases the camera", async ({ page }) => {
  // A tab that holds the camera open after the call has ended keeps the
  // hardware light on, which people reasonably read as being recorded.
  await signIn(page, "ada");
  await openRoom(page);

  await page.getByRole("button", { name: "Leave the room" }).click();
  await expect(page.locator("video")).toHaveCount(0);
});
