"use client";

import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** One image the viewer can display. `alt` is preserved as the real alt text. */
export type ViewerImage = {
  src: string;
  alt: string;
  /** Optional secondary line, e.g. the stored filename. */
  caption?: string;
};

type ImageViewerProps = {
  images: ViewerImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Short label shown in the viewer header, e.g. the project or gallery name. */
  label?: string;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const BUTTON_ZOOM_STEP = 1.5;
const WHEEL_SENSITIVITY = 0.0018;
const DOUBLE_TAP_ZOOM = 2.4;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_SLOP = 32;
const DRAG_SLOP = 8;

type Point = { x: number; y: number };
/** Zoom + pan, tagged with the image it belongs to so navigation resets it. */
type ViewState = { zoom: number; x: number; y: number; index: number };

function resetView(index: number): ViewState {
  return { zoom: 1, x: 0, y: 0, index };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none">
      <path
        d={direction === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none">
      <circle cx="9" cy="9" r="5.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 6.6v4.8M6.6 9h4.8M13 13l3.4 3.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none">
      <circle cx="9" cy="9" r="5.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.6 9h4.8M13 13l3.4 3.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none">
      <path d="M3.6 8V3.8H7.8M16.4 12v4.2H12.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M3.9 8a6.2 6.2 0 0 1 10.3-2.4M16.1 12a6.2 6.2 0 0 1-10.3 2.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-4 w-4" fill="none">
      <path d="M7 4H4.5A1.5 1.5 0 0 0 3 5.5v8A1.5 1.5 0 0 0 4.5 15h8a1.5 1.5 0 0 0 1.5-1.5V11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      <path d="M10.5 3H15v4.5M15 3 8.5 9.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  );
}

/**
 * Shared responsive lightbox used by the collective image gallery, project
 * cards, and the project editor. Renders in a portal so it always sits above
 * dialogs, keeps the page from scrolling behind it, and supports zoom in/out,
 * reset, pan, keyboard, and backdrop/tap-to-close on phone, tablet, desktop.
 */
export default function ImageViewer({ images, index, onIndexChange, onClose, label }: ImageViewerProps) {
  const [viewState, setViewState] = useState<ViewState>(() => resetView(index));
  const [interacting, setInteracting] = useState(false);
  const [readySrc, setReadySrc] = useState("");
  const [failedSrc, setFailedSrc] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const viewRef = useRef<ViewState>(viewState);
  const pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{
    startDistance: number;
    startZoom: number;
    startMid: Point;
    startLocal: Point;
  } | null>(null);
  const dragRef = useRef<{ start: Point; startOffset: Point; moved: boolean } | null>(null);
  const lastTapRef = useRef<{ time: number; point: Point } | null>(null);
  const suppressClickRef = useRef(false);
  const wheelTimerRef = useRef<number | null>(null);

  const safeIndex = images.length ? clamp(index, 0, images.length - 1) : 0;
  const image = images[safeIndex];
  const hasMultiple = images.length > 1;
  // A view recorded for another image falls back to "fit", so browsing resets zoom.
  const view = viewState.index === safeIndex ? viewState : resetView(safeIndex);

  const applyView = useCallback((next: ViewState) => {
    viewRef.current = next;
    setViewState(next);
  }, []);

  /** Zoom/pan state for the image on screen, never a stale one. */
  const currentView = useCallback(
    () => (viewRef.current.index === safeIndex ? viewRef.current : resetView(safeIndex)),
    [safeIndex],
  );

  /** Keeps the zoomed image from being dragged completely out of the frame. */
  const clampView = useCallback((next: ViewState): ViewState => {
    const stage = stageRef.current;
    const img = imageRef.current;
    if (!stage || !img) return next;
    const maxX = Math.max(0, (img.offsetWidth * next.zoom - stage.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * next.zoom - stage.clientHeight) / 2);
    return {
      zoom: next.zoom,
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
      index: next.index,
    };
  }, []);

  const zoomAt = useCallback((clientX: number, clientY: number, nextZoom: number) => {
    const stage = stageRef.current;
    const current = currentView();
    const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    // Keep the point under the cursor/pinch anchored to itself while scaling.
    const localX = (clientX - centerX - current.x) / current.zoom;
    const localY = (clientY - centerY - current.y) / current.zoom;
    applyView(clampView({
      zoom,
      x: clientX - centerX - localX * zoom,
      y: clientY - centerY - localY * zoom,
      index: current.index,
    }));
  }, [applyView, clampView, currentView]);

  const zoomFromCenter = useCallback((factor: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    zoomAt(
      rect ? rect.left + rect.width / 2 : 0,
      rect ? rect.top + rect.height / 2 : 0,
      currentView().zoom * factor,
    );
  }, [currentView, zoomAt]);

  const resetZoom = useCallback(() => applyView(resetView(safeIndex)), [applyView, safeIndex]);

  const goTo = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= images.length) return;
    applyView(resetView(nextIndex));
    onIndexChange(nextIndex);
  }, [applyView, images.length, onIndexChange]);

  // Lock background scrolling without shifting the layout when the scrollbar goes.
  useEffect(() => {
    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, []);

  // Move focus into the dialog and give it back to the trigger on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  // Trackpad/mouse wheel zoom (registered natively so it can preventDefault).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      if (wheelTimerRef.current) window.clearTimeout(wheelTimerRef.current);
      setInteracting(true);
      wheelTimerRef.current = window.setTimeout(() => setInteracting(false), 140);
      const factor = Math.exp(-event.deltaY * WHEEL_SENSITIVITY);
      zoomAt(event.clientX, event.clientY, currentView().zoom * factor);
    }
    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      stage.removeEventListener("wheel", handleWheel);
      if (wheelTimerRef.current) window.clearTimeout(wheelTimerRef.current);
    };
  }, [currentView, zoomAt]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      switch (event.key) {
        case "Escape":
          event.preventDefault();
          onClose();
          break;
        case "ArrowLeft":
          if (!hasMultiple) return;
          event.preventDefault();
          goTo(safeIndex - 1);
          break;
        case "ArrowRight":
          if (!hasMultiple) return;
          event.preventDefault();
          goTo(safeIndex + 1);
          break;
        case "+":
        case "=":
          event.preventDefault();
          zoomFromCenter(BUTTON_ZOOM_STEP);
          break;
        case "-":
        case "_":
          event.preventDefault();
          zoomFromCenter(1 / BUTTON_ZOOM_STEP);
          break;
        case "0":
          event.preventDefault();
          resetZoom();
          break;
        case "Tab": {
          const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
          );
          if (!focusables || focusables.length === 0) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const active = document.activeElement;
          if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
          }
          break;
        }
        default:
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goTo, hasMultiple, onClose, resetZoom, safeIndex, zoomFromCenter]);

  function toggleZoomAt(point: Point) {
    if (currentView().zoom > MIN_ZOOM + 0.01) {
      resetZoom();
      return;
    }
    zoomAt(point.x, point.y, DOUBLE_TAP_ZOOM);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Nav/zoom controls sit on top of the stage; ignore gestures started on them.
    if ((event.target as HTMLElement).closest("button, a")) return;
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, point);

    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const current = currentView();
      const rect = stageRef.current?.getBoundingClientRect();
      const mid = midpoint(a, b);
      const centerX = rect ? rect.left + rect.width / 2 : 0;
      const centerY = rect ? rect.top + rect.height / 2 : 0;
      const zoom = Math.max(current.zoom, MIN_ZOOM);
      pinchRef.current = {
        startDistance: Math.max(1, distance(a, b)),
        startZoom: zoom,
        startMid: mid,
        startLocal: {
          x: (mid.x - centerX - current.x) / zoom,
          y: (mid.y - centerY - current.y) / zoom,
        },
      };
      dragRef.current = null;
      setInteracting(true);
      return;
    }

    if (pointersRef.current.size === 1) {
      const current = currentView();
      dragRef.current = { start: point, startOffset: { x: current.x, y: current.y }, moved: false };
      setInteracting(true);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    const point = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, point);

    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const mid = midpoint(a, b);
      const nextZoom = clamp(pinch.startZoom * (distance(a, b) / pinch.startDistance), MIN_ZOOM, MAX_ZOOM);
      const rect = stageRef.current?.getBoundingClientRect();
      const centerX = rect ? rect.left + rect.width / 2 : 0;
      const centerY = rect ? rect.top + rect.height / 2 : 0;
      applyView(clampView({
        zoom: nextZoom,
        x: mid.x - centerX - pinch.startLocal.x * nextZoom,
        y: mid.y - centerY - pinch.startLocal.y * nextZoom,
        index: safeIndex,
      }));
      return;
    }

    const drag = dragRef.current;
    if (drag) {
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      if (Math.abs(dx) > DRAG_SLOP || Math.abs(dy) > DRAG_SLOP) drag.moved = true;
      const current = currentView();
      applyView(clampView({ zoom: current.zoom, x: drag.startOffset.x + dx, y: drag.startOffset.y + dy, index: safeIndex }));
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const point = pointersRef.current.get(event.pointerId) ?? { x: event.clientX, y: event.clientY };
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size > 0) return;

    const drag = dragRef.current;
    dragRef.current = null;
    setInteracting(false);
    suppressClickRef.current = Boolean(drag?.moved);

    if (!drag || drag.moved) return;
    // Double-tap / double-click toggles between fit and zoomed.
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && now - last.time < DOUBLE_TAP_MS && distance(point, last.point) < DOUBLE_TAP_SLOP) {
      lastTapRef.current = null;
      toggleZoomAt(point);
      return;
    }
    lastTapRef.current = { time: now, point };
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    dragRef.current = null;
    setInteracting(false);
  }

  function handleBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (event.target === event.currentTarget) onClose();
  }

  // Nothing to render during SSR — the viewer only opens from a user action.
  if (typeof document === "undefined" || !image) return null;

  const zoomPercent = Math.round(view.zoom * 100);
  const isZoomed = view.zoom > MIN_ZOOM + 0.01;
  const status = failedSrc === image.src ? "error" : readySrc === image.src ? "ready" : "loading";

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={label ? `Image viewer — ${label}` : "Image viewer"}
      className="viewer-shell fixed inset-0 z-[200] flex flex-col bg-black/92 backdrop-blur-[3px]"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7ff8a]">
            {label || "Image viewer"}
          </p>
          <p className="mt-0.5 text-[10px] text-[#8aa77e]">
            {hasMultiple ? `Image ${safeIndex + 1} of ${images.length}` : "Single image"} · {zoomPercent}%
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
          title="Close (Esc)"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition hover:border-white/40 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b7ff8a]"
        >
          <CloseIcon />
        </button>
      </div>

      <div
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleBackdropClick}
        className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden px-2 py-3 sm:px-4"
      >
        {hasMultiple && (
          <button
            type="button"
            onClick={() => goTo(safeIndex - 1)}
            disabled={safeIndex === 0}
            aria-label="Previous image"
            title="Previous image (←)"
            className="absolute left-1 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/60 text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-30 sm:left-3"
          >
            <ChevronIcon direction="left" />
          </button>
        )}

        {status === "error" ? (
          <p role="alert" className="max-w-[320px] text-center text-[12px] leading-6 text-[#ffc0a8]">
            This image could not be loaded. It may have been removed.
          </p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- served from the image API and must stay zoomable/raw
          <img
            ref={imageRef}
            key={image.src}
            src={image.src}
            alt={image.alt}
            draggable={false}
            onLoad={() => setReadySrc(image.src)}
            onError={() => setFailedSrc(image.src)}
            className="max-h-full max-w-full select-none object-contain shadow-[0_18px_60px_rgba(0,0,0,0.55)]"
            style={{
              transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`,
              transformOrigin: "center center",
              transition: interacting ? "none" : "transform 140ms ease-out",
              cursor: isZoomed ? "grab" : "zoom-in",
              visibility: status === "ready" ? "visible" : "hidden",
            }}
          />
        )}

        {status === "loading" && (
          <p role="status" className="absolute inset-0 grid place-items-center text-[11px] uppercase tracking-[0.16em] text-[#8aa77e]">
            Loading image…
          </p>
        )}

        {hasMultiple && (
          <button
            type="button"
            onClick={() => goTo(safeIndex + 1)}
            disabled={safeIndex === images.length - 1}
            aria-label="Next image"
            title="Next image (→)"
            className="absolute right-1 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/60 text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-30 sm:right-3"
          >
            <ChevronIcon direction="right" />
          </button>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-black/55 px-3 py-2.5 sm:px-4">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2.5">
          <p className="line-clamp-2 text-center text-[11px] leading-5 text-[#d6e9d2]">
            {image.alt || "Untitled image"}
            {image.caption && image.caption !== image.alt && (
              <span className="ml-2 text-[10px] text-[#8aa77e]">{image.caption}</span>
            )}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => zoomFromCenter(1 / BUTTON_ZOOM_STEP)}
              disabled={view.zoom <= MIN_ZOOM + 0.001}
              aria-label="Zoom out"
              title="Zoom out (−)"
              className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ZoomOutIcon />
              <span className="hidden sm:inline">Out</span>
            </button>
            <span aria-live="polite" className="min-w-[62px] text-center font-mono text-[12px] tabular-nums text-[#b7ff8a]">
              {zoomPercent}%
            </span>
            <button
              type="button"
              onClick={() => zoomFromCenter(BUTTON_ZOOM_STEP)}
              disabled={view.zoom >= MAX_ZOOM - 0.001}
              aria-label="Zoom in"
              title="Zoom in (+)"
              className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ZoomInIcon />
              <span className="hidden sm:inline">In</span>
            </button>
            <button
              type="button"
              onClick={resetZoom}
              disabled={!isZoomed}
              aria-label="Reset zoom"
              title="Reset zoom (0)"
              className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ResetIcon />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <a
              href={image.src}
              target="_blank"
              rel="noreferrer"
              title="Open the original image in a new tab"
              className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-white transition hover:bg-white/20"
            >
              <ExternalIcon />
              <span className="hidden sm:inline">Original</span>
            </a>
          </div>

          <p className="hidden text-center text-[10px] leading-4 text-[#7f9a76] sm:block">
            Scroll or pinch to zoom · drag to pan · double-click to toggle · arrow keys to browse · Esc to close
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
