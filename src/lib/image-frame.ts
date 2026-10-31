export type ImageFrame = { aspect: number; focus: number };
export const GALLERY_ASPECT = 4 / 5;
/** Preserve proportions. Focus chooses the retained part of a tall photo; never stretch. */
export function cropRect(width: number, height: number, frame?: ImageFrame) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error("Invalid image dimensions");
  if (!frame) return { sx: 0, sy: 0, cw: width, ch: height };
  if (
    !Number.isFinite(frame.aspect) ||
    frame.aspect <= 0 ||
    !Number.isFinite(frame.focus) ||
    frame.focus < 0 ||
    frame.focus > 1
  )
    throw new Error("Invalid image frame");
  if (width / height > frame.aspect) {
    const cw = Math.max(1, Math.round(height * frame.aspect));
    return { sx: Math.round((width - cw) / 2), sy: 0, cw, ch: height };
  }
  const ch = Math.max(1, Math.round(width / frame.aspect));
  return { sx: 0, sy: Math.round((height - ch) * frame.focus), cw: width, ch };
}
