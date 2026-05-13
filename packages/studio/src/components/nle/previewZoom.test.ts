import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREVIEW_ZOOM,
  MAX_PREVIEW_ZOOM_PERCENT,
  MIN_PREVIEW_ZOOM_PERCENT,
  clampPreviewPan,
  clampPreviewZoomPercent,
  getNextPreviewZoomPercent,
  getPreviewWheelZoomPercent,
  resolvePreviewWheelZoom,
  toDomPrecision,
} from "./previewZoom";

describe("toDomPrecision", () => {
  it("rounds to 4 decimal places", () => {
    expect(toDomPrecision(1.23456789)).toBe(1.2346);
  });

  it("preserves zero", () => {
    expect(toDomPrecision(0)).toBe(0);
  });

  it("handles negative values", () => {
    expect(toDomPrecision(-3.14159)).toBe(-3.1416);
  });
});

describe("clampPreviewZoomPercent", () => {
  it("falls back to fit zoom for invalid input", () => {
    expect(clampPreviewZoomPercent(Number.NaN)).toBe(100);
  });

  it("clamps to supported preview zoom bounds", () => {
    expect(clampPreviewZoomPercent(1)).toBe(MIN_PREVIEW_ZOOM_PERCENT);
    expect(clampPreviewZoomPercent(5000)).toBe(MAX_PREVIEW_ZOOM_PERCENT);
  });
});

describe("getPreviewWheelZoomPercent", () => {
  it("zooms in on negative deltaY (scroll up / pinch out)", () => {
    expect(getPreviewWheelZoomPercent(-5, 100)).toBeGreaterThan(100);
  });

  it("zooms out on positive deltaY (scroll down / pinch in)", () => {
    expect(getPreviewWheelZoomPercent(5, 200)).toBeLessThan(200);
  });

  it("clamps large deltas to prevent overshoot", () => {
    const small = getPreviewWheelZoomPercent(-5, 100);
    const large = getPreviewWheelZoomPercent(-50, 100);
    expect(large).toBeLessThan(small * 2);
  });

  it("preserves the current zoom for invalid input", () => {
    expect(getPreviewWheelZoomPercent(Number.NaN, 180)).toBe(180);
  });
});

describe("getNextPreviewZoomPercent", () => {
  it("steps preview zoom in and out", () => {
    expect(getNextPreviewZoomPercent("in", 100)).toBe(125);
    expect(getNextPreviewZoomPercent("out", 125)).toBe(100);
  });
});

describe("clampPreviewPan", () => {
  it("centers the preview when fit or zoomed out", () => {
    expect(
      clampPreviewPan({
        panX: 120,
        panY: -90,
        zoomPercent: 100,
        viewportWidth: 800,
        viewportHeight: 600,
      }),
    ).toEqual({ panX: 0, panY: 0 });
  });

  it("keeps pan within the zoomed preview bounds", () => {
    expect(
      clampPreviewPan({
        panX: 900,
        panY: -900,
        zoomPercent: 200,
        viewportWidth: 800,
        viewportHeight: 600,
      }),
    ).toEqual({ panX: 400, panY: -300 });
  });
});

describe("resolvePreviewWheelZoom", () => {
  it("zooms in from center without shifting pan", () => {
    const next = resolvePreviewWheelZoom({
      state: DEFAULT_PREVIEW_ZOOM,
      deltaY: -5,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    expect(next.zoomPercent).toBeGreaterThan(100);
    expect(next.panX).toBe(0);
    expect(next.panY).toBe(0);
  });

  it("clamps pan when zooming out past minimum", () => {
    const next = resolvePreviewWheelZoom({
      state: { zoomPercent: 26, panX: 20, panY: 20 },
      deltaY: 500,
      viewportWidth: 800,
      viewportHeight: 600,
    });

    expect(next.zoomPercent).toBeCloseTo(MIN_PREVIEW_ZOOM_PERCENT, 0);
    expect(next.panX).toBe(0);
    expect(next.panY).toBe(0);
  });
});
