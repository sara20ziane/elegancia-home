import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n-context";
import { GALLERY_ASPECT, type ImageFrame } from "@/lib/image-frame";

export function ImageUploadPreview({
  file,
  onUpload,
  onCancel,
}: {
  file: File;
  onUpload: (frame?: ImageFrame) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [crop, setCrop] = useState(false);
  const [focus, setFocus] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const locked = useRef(false);
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  const upload = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    try {
      await onUpload(crop ? { aspect: GALLERY_ASPECT, focus } : undefined);
    } catch {
      setError(true);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return (
    <section
      className="flex flex-col gap-3 rounded-[12px] border border-outline p-4"
      aria-label={t("image.preview")}
    >
      <p className="text-sm font-medium">
        {t("image.preview")} · {file.name}
      </p>
      {url && (
        <img
          src={url}
          alt={file.name}
          className="aspect-[4/5] w-full rounded-[12px] bg-surface-mid"
          style={{ objectFit: crop ? "cover" : "contain", objectPosition: `50% ${focus * 100}%` }}
        />
      )}
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={crop}
          disabled={busy}
          onChange={(event) => setCrop(event.target.checked)}
        />
        {t("image.crop")}
      </label>
      {!crop && <p className="text-xs text-on-surface-muted">{t("image.full")}</p>}
      {crop && (
        <label className="text-sm">
          {t("image.focus")}
          <input
            aria-label={t("image.focus")}
            className="w-full"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={focus}
            disabled={busy}
            onChange={(event) => setFocus(Number(event.target.value))}
          />
        </label>
      )}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => void upload()}>
          {t("image.upload")}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
      {error && <p role="alert">{t("common.somethingWrong")}</p>}
    </section>
  );
}
