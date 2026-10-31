import { describe, expect, it } from "vitest";
import { exceedsOrderLimits } from "./order-limits";
import { cropRect } from "./image-frame";
import { spreadsheetText } from "./spreadsheet";
import { isNewer } from "./version";

describe("selected upstream safety", () => {
  it("permits bedding bundles and enforces aggregate quantity limits", () => {
    expect(
      exceedsOrderLimits([
        { variant_id: "a", quantity: 20 },
        { variant_id: "b", quantity: 20 },
        { variant_id: "c", quantity: 10 },
      ]),
    ).toBe(false);
    expect(
      exceedsOrderLimits([
        { variant_id: "a", quantity: 11 },
        { variant_id: "a", quantity: 10 },
      ]),
    ).toBe(true);
    expect(
      exceedsOrderLimits([
        { variant_id: "a", quantity: 20 },
        { variant_id: "b", quantity: 20 },
        { variant_id: "c", quantity: 11 },
      ]),
    ).toBe(true);
  });
  it.each([0, -1, 0.5, NaN, Infinity])("rejects invalid quantity %s", (quantity) =>
    expect(exceedsOrderLimits([{ variant_id: "a", quantity }])).toBe(true),
  );
  it("preserves complete photos by default and crops to 4:3 without stretching", () => {
    expect(cropRect(800, 1200)).toEqual({ sx: 0, sy: 0, cw: 800, ch: 1200 });
    expect(cropRect(800, 1200, { aspect: 4 / 3, focus: 1 })).toEqual({
      sx: 0,
      sy: 600,
      cw: 800,
      ch: 600,
    });
    expect(cropRect(2000, 900, { aspect: 4 / 3, focus: 0.5 })).toEqual({
      sx: 400,
      sy: 0,
      cw: 1200,
      ch: 900,
    });
  });
  it("rejects invalid image dimensions and crop positions", () => {
    expect(() => cropRect(0, 1)).toThrow();
    expect(() => cropRect(800, 900, { aspect: 0, focus: 0.5 })).toThrow();
  });
  it.each(["=IMPORTXML()", " +SUM(1)", "\t@cmd", "-cmd", "\uFEFF=cmd"])(
    "neutralizes spreadsheet formula %s",
    (value) => expect(spreadsheetText(value)).toBe(`'${value}`),
  );
  it("preserves numbers, Arabic and normal text", () => {
    expect(spreadsheetText(-4)).toBe(-4);
    expect(spreadsheetText("غطاء")).toBe("غطاء");
    expect(spreadsheetText(null)).toBeNull();
  });
  it("compares only published numeric release versions", () => {
    expect(isNewer("v0.3.0", "0.2.0")).toBe(true);
    expect(isNewer("0.2.0", "0.2.0")).toBe(false);
    expect(isNewer("0.2.0-beta", "0.1.0")).toBe(false);
    expect(isNewer("bad", "0.1.0")).toBe(false);
  });
});
