import { DateTime } from "luxon";
import { TimeWindow } from "./types";

const DEFAULT_TZ = process.env.INTERN_DAILY_TZ || "Australia/Sydney";

export interface TimeWindowOptions {
  date?: string;
  since?: string;
  until?: string;
  tz?: string;
}

function parseIso(input: string, tz: string): DateTime {
  const dt = DateTime.fromISO(input, { setZone: true });
  if (dt.isValid) {
    return dt.setZone(tz);
  }
  const fallback = DateTime.fromISO(input, { zone: tz });
  if (!fallback.isValid) {
    throw new Error(`无法解析时间：${input}`);
  }
  return fallback;
}

function toIsoString(dt: DateTime): string {
  const iso = dt.toISO({ suppressMilliseconds: true });
  if (!iso) {
    throw new Error(`无法格式化时间：${dt.toString()}`);
  }
  return iso;
}

function toIsoDate(dt: DateTime): string {
  const isoDate = dt.toISODate();
  if (!isoDate) {
    throw new Error(`无法格式化日期：${dt.toString()}`);
  }
  return isoDate;
}

export function resolveTimeWindow(opts: TimeWindowOptions): TimeWindow {
  const tz = opts.tz || DEFAULT_TZ;

  if (opts.since || opts.until) {
    const now = DateTime.now().setZone(tz);
    const sinceDt = opts.since ? parseIso(opts.since, tz) : now.startOf("day");
    const untilDt = opts.until ? parseIso(opts.until, tz) : now.endOf("day");
    if (untilDt < sinceDt) {
      throw new Error("时间范围非法：结束时间早于开始时间");
    }
    return {
      since: toIsoString(sinceDt),
      until: toIsoString(untilDt),
      dateLabel: toIsoDate(sinceDt),
      tz,
    };
  }

  const base = opts.date ? DateTime.fromISO(opts.date, { zone: tz }) : DateTime.now().setZone(tz);

  if (!base.isValid) {
    throw new Error(`无法解析日期：${opts.date}`);
  }

  const start = base.startOf("day");
  const end = base.endOf("day");

  return {
    since: toIsoString(start),
    until: toIsoString(end),
    dateLabel: toIsoDate(base),
    tz,
  };
}
