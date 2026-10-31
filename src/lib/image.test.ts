import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock("./supabase/client", () => ({
  getSupabase: () => ({
    storage: {
      from: () => ({
        upload,
        getPublicUrl: () => ({ data: { publicUrl: "https://test.invalid/image.webp" } }),
      }),
    },
  }),
}));
import { uploadProductImage } from "./image";
let draw: ReturnType<typeof vi.fn>;
let close: ReturnType<typeof vi.fn>;
beforeEach(() => {
  draw = vi.fn();
  close = vi.fn();
  upload.mockResolvedValue({ error: null });
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 800, height: 1200, close })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: draw,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) =>
    callback(new Blob(["image"], { type: "image/webp" })),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("uploads a bounded cropped WebP to the existing bucket with no overwrite", async () => {
  expect(
    await uploadProductImage(new File(["test"], "test.jpg", { type: "image/jpeg" }), "product", {
      aspect: 4 / 5,
      focus: 1,
    }),
  ).toEqual({ url: "https://test.invalid/image.webp", error: null });
  expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 200, 800, 1000, 0, 0, 800, 1000);
  expect(close).toHaveBeenCalledTimes(1);
  expect(upload).toHaveBeenCalledWith(
    expect.stringMatching(/^products\/product\/.+\.webp$/),
    expect.any(Blob),
    { contentType: "image/webp", upsert: false },
  );
});
it("preserves original proportions without crop and rejects invalid files", async () => {
  await uploadProductImage(new File(["test"], "test.png", { type: "image/png" }), "product");
  expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 1200, 0, 0, 800, 1200);
  expect(
    (
      await uploadProductImage(
        new File(["test"], "script.svg", { type: "image/svg+xml" }),
        "product",
      )
    ).url,
  ).toBeNull();
});
