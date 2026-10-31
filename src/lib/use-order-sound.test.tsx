import { act } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { renderTest } from "../../scripts/testing/react-render";
import { useOrderSound } from "./use-order-sound";
let sound: ReturnType<typeof useOrderSound>;
function Harness() {
  sound = useOrderSound();
  return <button onClick={() => void sound.toggle()}>sound</button>;
}
afterEach(() => vi.unstubAllGlobals());
it("plays quietly only after activation, and closes the audio context on unmount", async () => {
  const start = vi.fn();
  const close = vi.fn().mockResolvedValue(undefined);
  const resume = vi.fn().mockResolvedValue(undefined);
  const setValueAtTime = vi.fn();
  const create = vi.fn(() => ({
    frequency: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start,
    stop: vi.fn(),
  }));
  const Audio = vi.fn(function () {
    return {
      state: "running",
      currentTime: 0,
      destination: {},
      resume,
      close,
      createOscillator: create,
      createGain: () => ({
        gain: { setValueAtTime, exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
    };
  });
  vi.stubGlobal("AudioContext", Audio);
  const view = await renderTest(<Harness />);
  sound.play();
  expect(Audio).not.toHaveBeenCalled();
  await view.click("sound");
  expect(resume).toHaveBeenCalledTimes(1);
  sound.play();
  expect(start).toHaveBeenCalledTimes(1);
  expect(setValueAtTime).toHaveBeenCalledWith(0.025, 0);
  await view.click("sound");
  sound.play();
  expect(start).toHaveBeenCalledTimes(1);
  await view.unmount();
  expect(close).toHaveBeenCalledTimes(1);
});
it("leaves visual notifications usable if audio is unsupported", async () => {
  vi.stubGlobal("AudioContext", undefined);
  const view = await renderTest(<Harness />);
  await act(async () => {
    await sound.toggle();
  });
  expect(sound.enabled).toBe(false);
  expect(sound.unavailable).toBe(true);
  expect(sound.play).not.toThrow();
  await view.unmount();
});
