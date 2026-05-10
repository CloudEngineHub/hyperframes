import { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { StoryboardCard } from "./StoryboardCard";
import { MiniMap } from "./MiniMap";
import { TimeRuler } from "./TimeRuler";
import { CardContextMenu } from "./CardContextMenu";

// ── Constants ───────────────────────────────────────────────────────────────

const PPS = 160; // pixels per second
const CARD_HEIGHT = 180;
const CARD_GAP_Y = 24;
const CARD_Y_OFFSET = 40; // below the time ruler
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 1.5;
const SNAP_TOLERANCE = 5; // px for snap guides
const MIN_CARD_WIDTH = 160;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Parse a composition path into a clean display title. */
export function formatCompositionTitle(path: string): string {
  if (path === "index.html") return "Master";
  // Strip directory prefix and extension.
  const filename = path.split("/").pop() ?? path;
  const name = filename.replace(/\.(html|htm)$/i, "");
  // Convert kebab-case / snake_case to Title Case.
  return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Types ───────────────────────────────────────────────────────────────────

interface StoryboardComposition {
  id: string;
  path: string;
  title: string;
  start: number;
  duration: number;
}

export interface StoryboardCanvasProps {
  projectId: string;
  compositions: StoryboardComposition[];
  selectedId: string | null;
  onSelectComposition: (id: string, path: string) => void;
  currentTime: number;
  isPlaying: boolean;
  totalDuration: number;
  onReorderComposition?: (id: string, newStart: number) => void;
  onDuplicateComposition?: (id: string) => void;
  onDeleteComposition?: (id: string) => void;
  onEditSource?: (id: string, path: string) => void;
}

// ── Layout: assign cards to non-overlapping tracks ──────────────────────────

interface LayoutCard extends StoryboardComposition {
  x: number;
  y: number;
  width: number;
  height: number;
  displayTitle: string;
}

function layoutCards(compositions: StoryboardComposition[]): LayoutCard[] {
  // Sort by start time so greedy track assignment works correctly.
  const sorted = [...compositions].sort((a, b) => a.start - b.start);

  // Each "track" records where its last card ends (in pixels).
  const trackEnds: number[] = [];

  return sorted.map((comp) => {
    const width = Math.max(MIN_CARD_WIDTH, comp.duration * PPS);
    const x = comp.start * PPS;
    const right = x + width;

    // Find the first track where this card doesn't overlap.
    let track = trackEnds.findIndex((end) => x >= end + 12); // 12px gap
    if (track === -1) {
      track = trackEnds.length;
      trackEnds.push(0);
    }
    trackEnds[track] = right;

    const y = CARD_Y_OFFSET + track * (CARD_HEIGHT + CARD_GAP_Y);

    return {
      ...comp,
      x,
      y,
      width,
      height: CARD_HEIGHT,
      displayTitle: formatCompositionTitle(comp.path),
    };
  });
}

// ── Gap detection for gap visualization ─────────────────────────────────────

interface Gap {
  start: number; // seconds
  duration: number; // seconds
  track: number;
}

function findGaps(cards: LayoutCard[]): Gap[] {
  if (cards.length < 2) return [];

  // Group cards by track (y position).
  const trackMap = new Map<number, LayoutCard[]>();
  for (const c of cards) {
    const existing = trackMap.get(c.y) ?? [];
    existing.push(c);
    trackMap.set(c.y, existing);
  }

  const gaps: Gap[] = [];
  let trackIdx = 0;
  for (const [, trackCards] of trackMap) {
    const sorted = [...trackCards].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length - 1; i++) {
      const endTime = sorted[i]!.start + sorted[i]!.duration;
      const nextStart = sorted[i + 1]!.start;
      if (nextStart - endTime > 0.1) {
        gaps.push({ start: endTime, duration: nextStart - endTime, track: trackIdx });
      }
    }
    trackIdx++;
  }

  return gaps;
}

// ── Snap guide computation ──────────────────────────────────────────────────

function computeSnapPositions(
  cards: LayoutCard[],
  excludeId: string,
  totalDuration: number,
): number[] {
  const positions: number[] = [];

  // Other cards' start/end positions.
  for (const c of cards) {
    if (c.id === excludeId) continue;
    positions.push(c.x);
    positions.push(c.x + c.width);
  }

  // Time ruler major tick positions (every second for short, every 5s for longer).
  const interval = totalDuration > 30 ? 5 : 1;
  for (let t = 0; t <= totalDuration; t += interval) {
    positions.push(t * PPS);
  }

  return positions;
}

function findSnap(dragX: number, snapPositions: number[], tolerance: number): number | null {
  let closest: number | null = null;
  let closestDist = tolerance + 1;
  for (const pos of snapPositions) {
    const dist = Math.abs(dragX - pos);
    if (dist < closestDist) {
      closestDist = dist;
      closest = pos;
    }
  }
  return closestDist <= tolerance ? closest : null;
}

// ── Context menu state ──────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  cardId: string;
  cardPath: string;
  cardTitle: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export const StoryboardCanvas = memo(function StoryboardCanvas({
  projectId,
  compositions,
  selectedId,
  onSelectComposition,
  currentTime,
  isPlaying,
  totalDuration,
  onReorderComposition,
  onDuplicateComposition,
  onDeleteComposition,
  onEditSource,
}: StoryboardCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Space-bar panning state.
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panDragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Drag state ────────────────────────────────────────────────────────────

  const [dragState, setDragState] = useState<{
    cardId: string;
    offsetX: number;
    offsetY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const [activeSnapLine, setActiveSnapLine] = useState<number | null>(null);

  // ── Context menu state ────────────────────────────────────────────────────

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // ── Derived layout ──────────────────────────────────────────────────────

  const cards = useMemo(() => layoutCards(compositions), [compositions]);
  const gaps = useMemo(() => findGaps(cards), [cards]);

  // Snap positions for dragging.
  const snapPositions = useMemo(
    () => (dragState ? computeSnapPositions(cards, dragState.cardId, totalDuration) : []),
    [cards, dragState, totalDuration],
  );

  // ── Zoom helper ─────────────────────────────────────────────────────────

  const clampZoom = useCallback((z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)), []);

  const zoomAtCursor = useCallback(
    (newZoom: number, clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;

      setZoom((prevZoom) => {
        const clamped = clampZoom(newZoom);
        const ratio = clamped / prevZoom;
        setPanX((px) => cx - ratio * (cx - px));
        setPanY((py) => cy - ratio * (cy - py));
        return clamped;
      });
    },
    [clampZoom],
  );

  // ── Wheel handler ───────────────────────────────────────────────────────

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Zoom (Ctrl+wheel or pinch-to-zoom).
        const factor = e.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
        zoomAtCursor(zoom * factor, e.clientX, e.clientY);
        return;
      }

      if (e.shiftKey) {
        // Horizontal pan.
        setPanX((px) => px - e.deltaY);
      } else {
        // Vertical pan.
        setPanY((py) => py - e.deltaY);
        setPanX((px) => px - e.deltaX);
      }
    },
    [zoom, zoomAtCursor],
  );

  // ── Pointer handlers (space-drag + middle-click pan) ────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Close context menu on any click.
      if (contextMenu) setContextMenu(null);

      if (e.button === 1 || (spaceHeld && e.button === 0)) {
        e.preventDefault();
        panDragRef.current = {
          active: true,
          startX: e.clientX,
          startY: e.clientY,
          startPanX: panX,
          startPanY: panY,
        };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    },
    [spaceHeld, panX, panY, contextMenu],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Pan drag.
      const drag = panDragRef.current;
      if (drag?.active) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        setPanX(drag.startPanX + dx);
        setPanY(drag.startPanY + dy);
        return;
      }

      // Card drag.
      if (dragState) {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left - panX) / zoom;
        const canvasY = (e.clientY - rect.top - panY) / zoom;

        // Check snap.
        const snapX = findSnap(canvasX, snapPositions, SNAP_TOLERANCE / zoom);
        setActiveSnapLine(snapX);

        setDragState((prev) =>
          prev ? { ...prev, currentX: snapX ?? canvasX, currentY: canvasY } : null,
        );
      }
    },
    [dragState, panX, panY, zoom, snapPositions],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (panDragRef.current?.active) {
        panDragRef.current = null;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        return;
      }

      // Card drag drop.
      if (dragState) {
        const newStart = Math.max(0, dragState.currentX / PPS);
        onReorderComposition?.(dragState.cardId, newStart);
        setDragState(null);
        setActiveSnapLine(null);
      }
    },
    [dragState, onReorderComposition],
  );

  // ── Card drag start handler ─────────────────────────────────────────────

  const handleCardDragStart = useCallback(
    (cardId: string, offsetX: number, offsetY: number) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      setDragState({
        cardId,
        offsetX,
        offsetY,
        currentX: card.x,
        currentY: card.y,
      });
    },
    [cards],
  );

  // ── Context menu handlers ─────────────────────────────────────────────

  const handleCardContextMenu = useCallback(
    (cardId: string, clientX: number, clientY: number) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      setContextMenu({
        x: clientX,
        y: clientY,
        cardId: card.id,
        cardPath: card.path,
        cardTitle: card.displayTitle,
      });
    },
    [cards],
  );

  const handleContextMenuClose = useCallback(() => setContextMenu(null), []);

  const handleContextMenuPreview = useCallback(() => {
    if (!contextMenu) return;
    onSelectComposition(contextMenu.cardId, contextMenu.cardPath);
  }, [contextMenu, onSelectComposition]);

  const handleContextMenuDuplicate = useCallback(() => {
    if (!contextMenu) return;
    onDuplicateComposition?.(contextMenu.cardId);
  }, [contextMenu, onDuplicateComposition]);

  const handleContextMenuDelete = useCallback(() => {
    if (!contextMenu) return;
    onDeleteComposition?.(contextMenu.cardId);
  }, [contextMenu, onDeleteComposition]);

  const handleContextMenuEditSource = useCallback(() => {
    if (!contextMenu) return;
    onEditSource?.(contextMenu.cardId, contextMenu.cardPath);
  }, [contextMenu, onEditSource]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        // Don't capture space if focus is in an input.
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }

      const modKey = e.ctrlKey || e.metaKey;

      if (modKey && e.key === "0") {
        e.preventDefault();
        fitAll();
        return;
      }

      if (modKey && e.key === "1") {
        e.preventDefault();
        setZoom(1);
        return;
      }

      if (e.key === "Escape") {
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        onSelectComposition("", "");
        return;
      }

      // Enter: open selected card in Preview.
      if (e.key === "Enter" && selectedId) {
        e.preventDefault();
        const card = cards.find((c) => c.id === selectedId);
        if (card) onSelectComposition(card.id, card.path);
        return;
      }

      // Delete/Backspace: delete selected card.
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        onDeleteComposition?.(selectedId);
        return;
      }

      // Cmd+A: select all.
      if (modKey && e.key === "a") {
        e.preventDefault();
        // Log for now — multi-select is future work.
        console.log("[Storyboard] Select all cards");
        return;
      }

      // Cmd+D: duplicate selected.
      if (modKey && e.key === "d" && selectedId) {
        e.preventDefault();
        onDuplicateComposition?.(selectedId);
        return;
      }

      // Arrow-key card navigation.
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        navigateCards(e.key);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceHeld(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compositions, selectedId, contextMenu, cards]);

  // ── Fit all cards into view ─────────────────────────────────────────────

  const fitAll = useCallback(() => {
    const container = containerRef.current;
    if (!container || cards.length === 0) return;

    const rect = container.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of cards) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + c.width);
      maxY = Math.max(maxY, c.y + c.height);
    }

    const pad = 60;
    const contentW = maxX - minX + pad * 2;
    const contentH = maxY - minY + pad * 2;
    const fitZoom = clampZoom(Math.min(rect.width / contentW, rect.height / contentH));

    setZoom(fitZoom);
    setPanX((rect.width - contentW * fitZoom) / 2 - minX * fitZoom + pad * fitZoom);
    setPanY((rect.height - contentH * fitZoom) / 2 - minY * fitZoom + pad * fitZoom);
  }, [cards, clampZoom]);

  // ── Arrow navigation ────────────────────────────────────────────────────

  const navigateCards = useCallback(
    (direction: string) => {
      if (cards.length === 0) return;
      const currentIdx = cards.findIndex((c) => c.id === selectedId);

      let nextIdx: number;
      if (currentIdx === -1) {
        nextIdx = 0;
      } else if (direction === "ArrowRight") {
        nextIdx = Math.min(currentIdx + 1, cards.length - 1);
      } else if (direction === "ArrowLeft") {
        nextIdx = Math.max(currentIdx - 1, 0);
      } else {
        // Up/Down: find the nearest card in an adjacent track.
        const current = cards[currentIdx]!;
        const dy = direction === "ArrowDown" ? 1 : -1;
        const targetY = current.y + dy * (CARD_HEIGHT + CARD_GAP_Y);
        let best = currentIdx;
        let bestDist = Infinity;
        for (let i = 0; i < cards.length; i++) {
          const c = cards[i]!;
          if (Math.abs(c.y - targetY) < CARD_GAP_Y) {
            const dist = Math.abs(c.x - current.x);
            if (dist < bestDist) {
              bestDist = dist;
              best = i;
            }
          }
        }
        nextIdx = best;
      }

      const next = cards[nextIdx];
      if (next) onSelectComposition(next.id, next.path);
    },
    [cards, selectedId, onSelectComposition],
  );

  // ── Auto-scroll playhead into view ────────────────────────────────────

  useEffect(() => {
    if (!isPlaying) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const playheadCanvasX = currentTime * PPS;
    const playheadScreenX = playheadCanvasX * zoom + panX;

    // If the playhead is outside the visible area, scroll to keep it in view.
    const margin = 100;
    if (playheadScreenX < margin || playheadScreenX > rect.width - margin) {
      setPanX(-playheadCanvasX * zoom + rect.width * 0.3);
    }
  }, [currentTime, isPlaying, zoom, panX]);

  // ── Container dimensions for minimap ────────────────────────────────────

  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Minimap jump-to ─────────────────────────────────────────────────────

  const handleMiniMapJump = useCallback((px: number, py: number) => {
    setPanX(px);
    setPanY(py);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  const miniMapCards = useMemo(
    () =>
      cards.map((c) => ({
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height,
        id: c.id,
        isSelected: c.id === selectedId,
      })),
    [cards, selectedId],
  );

  // Find the card being dragged for ghost rendering.
  const dragCard = dragState ? cards.find((c) => c.id === dragState.cardId) : null;

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-neutral-950 ${
        spaceHeld ? "cursor-grab" : ""
      } ${panDragRef.current?.active ? "cursor-grabbing" : ""}`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: "none" }}
    >
      {/* Grid background pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${panX}px ${panY}px`,
        }}
      />

      {/* Canvas content layer */}
      <div
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
        {/* Time ruler */}
        <TimeRuler duration={totalDuration} pixelsPerSecond={PPS} />

        {/* Playhead line */}
        {isPlaying && (
          <div
            className="absolute top-0 w-px bg-emerald-400 z-30 pointer-events-none"
            style={{
              left: currentTime * PPS,
              height: CARD_Y_OFFSET + 6 * (CARD_HEIGHT + CARD_GAP_Y), // tall enough for several tracks
            }}
          />
        )}

        {/* Gap visualizations */}
        {gaps.map((gap) => {
          const gapX = gap.start * PPS;
          const gapW = gap.duration * PPS;
          const gapY = CARD_Y_OFFSET + gap.track * (CARD_HEIGHT + CARD_GAP_Y);
          return (
            <div
              key={`gap-${gap.start}-${gap.track}`}
              className="absolute flex items-center justify-center"
              style={{ left: gapX, width: gapW, top: gapY, height: CARD_HEIGHT }}
            >
              <div className="border border-dashed border-neutral-800 rounded-lg w-full h-full flex items-center justify-center">
                <button
                  type="button"
                  className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-500 hover:text-neutral-300 transition-colors"
                  onClick={() =>
                    console.log(`[Storyboard] Add composition at ${gap.start.toFixed(1)}s`)
                  }
                >
                  +
                </button>
              </div>
            </div>
          );
        })}

        {/* Composition cards */}
        {cards.map((card) => {
          const isCurrent = currentTime >= card.start && currentTime < card.start + card.duration;
          const progress = isCurrent ? ((currentTime - card.start) / card.duration) * 100 : 0;

          // If this card is being dragged, show a ghost at the original position.
          const isBeingDragged = dragState?.cardId === card.id;

          return (
            <StoryboardCard
              key={card.id}
              id={card.id}
              path={card.path}
              title={card.displayTitle}
              start={card.start}
              duration={card.duration}
              x={isBeingDragged ? dragState!.currentX : card.x}
              y={isBeingDragged ? dragState!.currentY - CARD_HEIGHT / 2 : card.y}
              width={card.width}
              height={card.height}
              isSelected={card.id === selectedId}
              isCurrent={isCurrent}
              projectId={projectId}
              zoom={zoom}
              progress={progress}
              onClick={() => onSelectComposition(card.id, card.path)}
              onDragStart={handleCardDragStart}
              onContextMenu={handleCardContextMenu}
            />
          );
        })}

        {/* Ghost for dragged card (semi-transparent at original position) */}
        {dragCard && dragState && (
          <div
            className="absolute rounded-xl border-2 border-dashed border-neutral-700 bg-neutral-800/30 pointer-events-none"
            style={{
              left: dragCard.x,
              top: dragCard.y,
              width: dragCard.width,
              height: dragCard.height,
            }}
          />
        )}

        {/* Snap guide lines */}
        {activeSnapLine != null && dragState && (
          <div
            className="absolute top-0 w-px bg-cyan-400/60 z-40 pointer-events-none"
            style={{
              left: activeSnapLine,
              height: CARD_Y_OFFSET + 6 * (CARD_HEIGHT + CARD_GAP_Y),
            }}
          />
        )}
      </div>

      {/* MiniMap overlay (bottom-right) */}
      <MiniMap
        cards={miniMapCards}
        viewport={{ zoom, panX, panY }}
        containerWidth={containerSize.w}
        containerHeight={containerSize.h}
        onJumpTo={handleMiniMapJump}
      />

      {/* Zoom controls (bottom-left) */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-xl bg-neutral-900/90 border border-neutral-800 px-2 py-1">
        <button
          type="button"
          onClick={() => setZoom((z) => clampZoom(z / ZOOM_STEP))}
          className="h-6 w-6 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors text-sm"
          aria-label="Zoom out"
        >
          &minus;
        </button>
        <span className="text-[10px] text-neutral-400 w-10 text-center tabular-nums select-none">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((z) => clampZoom(z * ZOOM_STEP))}
          className="h-6 w-6 flex items-center justify-center rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors text-sm"
          aria-label="Zoom in"
        >
          +
        </button>
        <div className="mx-0.5 h-3 w-px bg-neutral-700" />
        <button
          type="button"
          onClick={fitAll}
          className="h-6 px-1.5 flex items-center justify-center rounded-md text-[10px] text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          aria-label="Fit all"
        >
          Fit
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <CardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          card={{
            id: contextMenu.cardId,
            path: contextMenu.cardPath,
            title: contextMenu.cardTitle,
          }}
          onClose={handleContextMenuClose}
          onOpenPreview={handleContextMenuPreview}
          onDuplicate={handleContextMenuDuplicate}
          onDelete={handleContextMenuDelete}
          onEditSource={handleContextMenuEditSource}
        />
      )}
    </div>
  );
});
