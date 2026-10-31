import { afterEach, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("uses navigator.clipboard", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  expect(await copyText("PACKERS-1")).toBe(true);
  expect(writeText).toHaveBeenCalledWith("PACKERS-1");
});
it("falls back if clipboard rejects, removes its field and restores focus", async () => {
  vi.stubGlobal("navigator", {
    clipboard: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
  });
  const execCommand = vi.fn(() => true);
  Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  expect(await copyText("PACKERS-2")).toBe(true);
  expect(execCommand).toHaveBeenCalledWith("copy");
  expect(document.querySelector("textarea")).toBeNull();
  expect(document.activeElement).toBe(input);
  input.remove();
});
it("reports failure for manual selection when both APIs fail", async () => {
  vi.stubGlobal("navigator", {});
  Object.defineProperty(document, "execCommand", { configurable: true, value: () => false });
  expect(await copyText("PACKERS-3")).toBe(false);
});
