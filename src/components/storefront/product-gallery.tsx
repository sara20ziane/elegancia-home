import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { ImageLightbox } from "./image-lightbox";
import { useI18n } from "@/lib/i18n-context";
import { cn } from "@/lib/utils";

/** Native swipe/scroll-snap, retaining Elegancia's frame, thumbnails and zoom. */
export function ProductGallery({
  images,
  alt,
  active,
  onSelect,
}: {
  images: string[];
  alt: string;
  active: number;
  onSelect: (index: number) => void;
}) {
  const { t } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const index = Math.max(0, Math.min(active, images.length - 1));
  const photoSet = images.join("|");
  const go = (next: number) => {
    const target = Math.max(0, Math.min(images.length - 1, next));
    onSelect(target);
    const element = track.current;
    if (element)
      element.scrollTo({
        left:
          target * element.clientWidth * (getComputedStyle(element).direction === "rtl" ? -1 : 1),
        behavior: "smooth",
      });
  };
  useEffect(() => {
    track.current?.scrollTo({ left: 0 });
  }, [photoSet]);
  if (!images.length)
    return (
      <div className="gallery-main">
        <ImageOff size={40} aria-hidden="true" />
      </div>
    );
  return (
    <div className="gallery min-w-0">
      <div className="relative min-w-0">
        <div
          ref={track}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[16px]"
          tabIndex={0}
          aria-label={alt}
          onScroll={() => {
            const el = track.current;
            if (el?.clientWidth) {
              const next = Math.max(
                0,
                Math.min(images.length - 1, Math.round(Math.abs(el.scrollLeft) / el.clientWidth)),
              );
              if (next !== active) onSelect(next);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              const forward =
                (event.key === "ArrowRight") !==
                (getComputedStyle(event.currentTarget).direction === "rtl");
              go(index + (forward ? 1 : -1));
            }
          }}
        >
          {images.map((url, position) => (
            <button
              key={`${url}-${position}`}
              type="button"
              className="gallery-main min-w-full shrink-0 snap-center cursor-zoom-in"
              onClick={() => setOpen(position)}
              aria-label={`${t("store.zoom")} ${position + 1}`}
            >
              <img
                src={url}
                alt={`${alt} ${position + 1}`}
                decoding="async"
                loading={position ? "lazy" : "eager"}
                draggable={false}
              />
            </button>
          ))}
        </div>
        {images.length > 1 && <GalleryArrows index={index} count={images.length} go={go} />}
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbs">
          {images.map((url, position) => (
            <button
              type="button"
              key={`${url}-${position}`}
              onClick={() => go(position)}
              aria-current={position === index}
              aria-label={`${t("store.description")} ${position + 1}`}
              className={cn("gallery-thumb", position === index && "active")}
            >
              <img src={url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <ImageLightbox
        images={images}
        index={open}
        alt={alt}
        onIndex={(next) => {
          setOpen(next);
          go(next);
        }}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}

function GalleryArrows({
  index,
  count,
  go,
}: {
  index: number;
  count: number;
  go: (index: number) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <button
        type="button"
        aria-label={t("common.previous")}
        disabled={index === 0}
        onClick={() => go(index - 1)}
        className="absolute start-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface/90 disabled:opacity-30"
      >
        <ChevronLeft className="rtl:rotate-180" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t("common.next")}
        disabled={index === count - 1}
        onClick={() => go(index + 1)}
        className="absolute end-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface/90 disabled:opacity-30"
      >
        <ChevronRight className="rtl:rotate-180" aria-hidden="true" />
      </button>
    </>
  );
}
