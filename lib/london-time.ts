/** Scheduled posts are UK civil time, including the March gap and October overlap. */

const LONDON = "Europe/London";
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const HAS_ZONE = /(?:Z|[+-]\d{2}:\d{2})$/i;

export interface LondonParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function londonParts(date: Date): LondonParts {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function isRealUtcDate(year: number, month: number, day: number): boolean {
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Europe/London wall time → UTC.
 * The spring-forward gap (01:00–01:59 on the last Sunday in March) is null.
 * The autumn overlap keeps the earlier instant, while clocks still say BST.
 */
export function londonWallToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0
): Date | null {
  if (
    !isRealUtcDate(year, month, day) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const matches: Date[] = [];
  for (const offsetMin of [0, 60]) {
    const instant = new Date(wall - offsetMin * 60_000);
    const parts = londonParts(instant);
    if (
      parts.year === year &&
      parts.month === month &&
      parts.day === day &&
      parts.hour === hour &&
      parts.minute === minute &&
      parts.second === second
    ) {
      matches.push(instant);
    }
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => a.getTime() - b.getTime());
  return matches[0];
}

/** `YYYY-MM-DDTHH:mm` as Europe/London. Strings that already have a zone are not accepted here. */
export function parseLondonDateTime(value: string): Date | null {
  const match = WALL_CLOCK.exec(value.trim());
  if (!match) return null;
  return londonWallToUtc(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    match[6] ? Number(match[6]) : 0
  );
}

export type ScheduledParse =
  | { ok: true; at: Date }
  | { ok: false; error: string };

/**
 * A zoned instant is kept as-is. A wall clock with no zone is Europe/London.
 * `now` is the fixed clock used for the future check.
 */
export function parseScheduledInstant(value: string, now: Date): ScheduledParse {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: "scheduledFor must be a valid date/time." };
  }

  let at: Date | null;
  if (HAS_ZONE.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "scheduledFor must be a valid date/time." };
    }
    at = parsed;
  } else {
    if (!WALL_CLOCK.test(trimmed)) {
      return { ok: false, error: "scheduledFor must be a valid date/time." };
    }
    at = parseLondonDateTime(trimmed);
    if (!at) {
      return {
        ok: false,
        error:
          "That time does not exist in Europe/London. Clocks spring forward at the end of March.",
      };
    }
  }

  if (at.getTime() <= now.getTime()) {
    return { ok: false, error: "scheduledFor must be in the future." };
  }
  return { ok: true, at };
}

export function formatLondonDateTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
