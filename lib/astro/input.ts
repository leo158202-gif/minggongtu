import { isHouseSystem } from './place';
import { ASTRO_ERRORS } from './errors';
import type { AstroCastInput, AstroDstChoice } from './types';

export function parseAstroCastInput(payload: unknown): { ok: true; input: AstroCastInput } | { ok: false; error: string } {
  if (!isRecord(payload)) return { ok: false, error: ASTRO_ERRORS.failed };
  const calendar = payload.calendar === 'lunar' ? 'lunar' : payload.calendar === 'solar' ? 'solar' : null;
  const year = integer(payload.year);
  const month = integer(payload.month);
  const day = integer(payload.day);
  const hour = integer(payload.hour);
  const minute = integer(payload.minute);
  const latitude = finite(payload.latitude);
  const longitude = finite(payload.longitude);
  const zone = typeof payload.zone === 'string' ? payload.zone.trim() : '';
  const houseSystem = typeof payload.houseSystem === 'string' ? payload.houseSystem : '';
  const dstChoice = payload.dstChoice === null || payload.dstChoice === undefined
    ? null
    : (payload.dstChoice === 'earlier' || payload.dstChoice === 'later' ? payload.dstChoice : undefined);
  if (!calendar || year === null || month === null || day === null || hour === null || minute === null) {
    return { ok: false, error: ASTRO_ERRORS.badDate };
  }
  if (latitude === null || longitude === null) return { ok: false, error: ASTRO_ERRORS.needPlace };
  if (!zone || zone.length > 64) return { ok: false, error: ASTRO_ERRORS.badZone };
  if (!isHouseSystem(houseSystem)) return { ok: false, error: ASTRO_ERRORS.badHouse };
  if (dstChoice === undefined) return { ok: false, error: ASTRO_ERRORS.failed };
  if (typeof payload.leapMonth !== 'boolean' || typeof payload.timeUnknown !== 'boolean' || typeof payload.acceptGap !== 'boolean') {
    return { ok: false, error: ASTRO_ERRORS.failed };
  }
  let transitUtc: string | null = null;
  if (payload.transitUtc != null) {
    if (typeof payload.transitUtc !== 'string' || payload.transitUtc.length > 40) return { ok: false, error: ASTRO_ERRORS.failed };
    transitUtc = payload.transitUtc;
  }
  const input: AstroCastInput = {
    calendar,
    year,
    month,
    day,
    hour,
    minute,
    leapMonth: payload.leapMonth,
    timeUnknown: payload.timeUnknown,
    latitude,
    longitude,
    zone,
    dstChoice: dstChoice as AstroDstChoice | null,
    acceptGap: payload.acceptGap,
    houseSystem,
    transitUtc,
  };
  return { ok: true, input };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function integer(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value;
}

function finite(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}
