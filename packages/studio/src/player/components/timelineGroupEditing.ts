import { roundToCenti } from "../../utils/rounding";

const DEFAULT_TIMELINE_MIN_DURATION = 0.1;
const ABSOLUTE_TIMELINE_MIN_DURATION = 0.05;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundTimelineTime(value: number): number {
  return roundToCenti(value);
}

export function resolveTimelineMinDuration(minDuration?: number): number {
  return Math.max(ABSOLUTE_TIMELINE_MIN_DURATION, minDuration ?? DEFAULT_TIMELINE_MIN_DURATION);
}

export interface TimelineGroupTimingMember {
  start: number;
  duration: number;
  playbackStart?: number;
  playbackRate?: number;
}

export type TimelineGroupResizeEdge = "start" | "end";

export interface TimelineGroupMoveResult {
  delta: number;
  members: Array<Pick<TimelineGroupTimingMember, "start" | "duration">>;
}

export interface TimelineGroupResizeResult {
  delta: number;
  members: Array<Pick<TimelineGroupTimingMember, "start" | "duration" | "playbackStart">>;
}

function clampTimelineGroupMoveDelta(
  rawDelta: number,
  members: readonly TimelineGroupTimingMember[],
): number {
  if (members.length === 0) return 0;
  const minDelta = Math.max(...members.map((member) => -member.start));
  return roundTimelineTime(Math.max(rawDelta, minDelta));
}

export function resolveTimelineGroupMove(
  members: readonly TimelineGroupTimingMember[],
  rawDelta: number,
): TimelineGroupMoveResult {
  const delta = clampTimelineGroupMoveDelta(rawDelta, members);
  return {
    delta,
    members: members.map((member) => ({
      start: roundTimelineTime(member.start + delta),
      duration: member.duration,
    })),
  };
}

export function clampTimelineGroupResizeDelta(
  rawDelta: number,
  members: readonly TimelineGroupTimingMember[],
  edge: TimelineGroupResizeEdge,
  minDuration = resolveTimelineMinDuration(),
): number {
  if (members.length === 0) return 0;

  if (edge === "end") {
    const minDelta = Math.max(...members.map((member) => minDuration - member.duration));
    return roundTimelineTime(Math.max(rawDelta, minDelta));
  }

  const minDelta = Math.max(
    ...members.map((member) => {
      const playbackRate = Math.max(0.1, member.playbackRate ?? 1);
      const maxLeftExtensionFromMedia =
        member.playbackStart != null
          ? member.playbackStart / playbackRate
          : Number.POSITIVE_INFINITY;
      return -Math.min(member.start, maxLeftExtensionFromMedia);
    }),
  );
  const maxDelta = Math.min(...members.map((member) => member.duration - minDuration));
  return roundTimelineTime(clamp(rawDelta, minDelta, maxDelta));
}

export function resolveTimelineGroupResize(
  members: readonly TimelineGroupTimingMember[],
  edge: TimelineGroupResizeEdge,
  rawDelta: number,
  minDuration = resolveTimelineMinDuration(),
): TimelineGroupResizeResult {
  const delta = clampTimelineGroupResizeDelta(rawDelta, members, edge, minDuration);
  return {
    delta,
    members: members.map((member) => {
      if (edge === "end") {
        return {
          start: member.start,
          duration: roundTimelineTime(member.duration + delta),
          playbackStart: member.playbackStart,
        };
      }

      const playbackRate = Math.max(0.1, member.playbackRate ?? 1);
      return {
        start: roundTimelineTime(member.start + delta),
        duration: roundTimelineTime(member.duration - delta),
        playbackStart:
          member.playbackStart != null
            ? roundTimelineTime(Math.max(0, member.playbackStart + delta * playbackRate))
            : undefined,
      };
    }),
  };
}
