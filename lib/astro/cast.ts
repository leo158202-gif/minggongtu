/**
 * 本命盘。只在服务端调用。
 * 计算库要世界时。钟面时间先经 caelus-birth 换算，夏令时重叠和空缺不自动当成已经排好的盘。
 */
import {
  Engine,
  VERSION,
  julianDay,
  transitAspects,
  transitHouses,
  type Chart,
  type ChartBody,
  type ChartWarning,
  type HouseSystem,
} from 'caelus';
import { embeddedData } from 'caelus/data-embedded';
import { toUT, type UTCandidate, type UTResult } from 'caelus-birth';
import { lunarToSolar } from '../ziwei/lunar-solar';
import { ASTRO_ERRORS } from './errors';
import {
  aspectLabel,
  bodyName,
  bodyShort,
  BODY_ORDER,
  clockText,
  dignityLabel,
  formatLat,
  formatLon,
  formatOffset,
  formatOrb,
  formatSignDegree,
  houseLabel,
  phaseLabel,
  signFromLongitude,
  signLabel,
} from './labels';
import type {
  AstroAspectView,
  AstroCastInput,
  AstroCastResult,
  AstroChartView,
  AstroCuspView,
  AstroDstChoice,
  AstroHouseSystem,
  AstroPointView,
  AstroPrompt,
  AstroTransitView,
} from './types';

export { ASTRO_ERRORS } from './errors';

const ZONE_RE = /^(?:UTC|Etc\/UTC|[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+)$/;

let engine: Engine | null = null;

function getEngine(): Engine {
  if (!engine) engine = new Engine(embeddedData);
  return engine;
}

interface SolarDate {
  year: number;
  month: number;
  day: number;
}

export function castAstro(input: AstroCastInput): AstroCastResult {
  if (input.timeUnknown) return { ok: false, error: ASTRO_ERRORS.unknownTime };
  const checked = validate(input);
  if (checked) return { ok: false, error: checked };

  const solar = resolveSolar(input);
  if ('error' in solar) return { ok: false, error: solar.error };

  let resolved: UTResult;
  try {
    resolved = toUT({
      year: solar.year,
      month: solar.month,
      day: solar.day,
      hour: input.hour,
      minute: input.minute,
      lat: input.latitude,
      lon: input.longitude,
      zone: input.zone === 'auto' ? undefined : input.zone,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('Unknown IANA')) return { ok: false, error: ASTRO_ERRORS.badZone };
    return { ok: false, error: ASTRO_ERRORS.failed };
  }

  if (resolved.status === 'ambiguous') {
    const options = dstOptions(resolved.candidates ?? []);
    if (!input.dstChoice || options.length < 2) {
      return {
        ok: false,
        error: ASTRO_ERRORS.ambiguous,
        prompt: { kind: 'ambiguous', zone: resolved.zone, options },
      };
    }
    const picked = options.find(option => option.id === input.dstChoice);
    const candidate = (resolved.candidates ?? []).find(item => (
      input.dstChoice === 'earlier'
        ? item.jdUt === Math.min(...(resolved.candidates ?? []).map(c => c.jdUt))
        : item.jdUt === Math.max(...(resolved.candidates ?? []).map(c => c.jdUt))
    ));
    if (!picked || !candidate) {
      return {
        ok: false,
        error: ASTRO_ERRORS.ambiguous,
        prompt: { kind: 'ambiguous', zone: resolved.zone, options },
      };
    }
    return draw(input, solar, {
      jdUt: candidate.jdUt,
      zone: resolved.zone,
      offsetMinutes: candidate.offsetMinutes,
      dst: candidate.dst,
      utc: utcFromJd(candidate.jdUt),
      status: 'chosen',
      dstChoice: input.dstChoice,
    });
  }

  if (resolved.status === 'nonexistent' && !input.acceptGap) {
    return {
      ok: false,
      error: ASTRO_ERRORS.gap,
      prompt: {
        kind: 'nonexistent',
        zone: resolved.zone,
        shiftedLocalText: localFromUtc(resolved.utc, resolved.offsetMinutes),
        shiftedUtcText: clockText(resolved.utc.year, resolved.utc.month, resolved.utc.day, resolved.utc.hour, resolved.utc.minute, resolved.utc.second),
        offsetLabel: formatOffset(resolved.offsetMinutes),
      },
    };
  }

  return draw(input, solar, {
    jdUt: resolved.jdUt,
    zone: resolved.zone,
    offsetMinutes: resolved.offsetMinutes,
    dst: resolved.dst,
    utc: resolved.utc,
    status: resolved.status === 'nonexistent' ? 'shifted' : 'ok',
    dstChoice: null,
    shiftedLocal: resolved.status === 'nonexistent' ? localFromUtc(resolved.utc, resolved.offsetMinutes) : undefined,
  });
}

function validate(input: AstroCastInput): string | null {
  if (!Number.isInteger(input.year) || input.year < 1000 || input.year > 3000) return ASTRO_ERRORS.badYear;
  if (!Number.isInteger(input.month) || !Number.isInteger(input.day)) return ASTRO_ERRORS.badDate;
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) return ASTRO_ERRORS.badTime;
  if (!Number.isInteger(input.minute) || input.minute < 0 || input.minute > 59) return ASTRO_ERRORS.badTime;
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) return ASTRO_ERRORS.badLat;
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) return ASTRO_ERRORS.badLon;
  if (input.zone !== 'auto' && (input.zone.length > 64 || !ZONE_RE.test(input.zone))) return ASTRO_ERRORS.badZone;
  if (!['placidus', 'whole_sign', 'equal', 'koch'].includes(input.houseSystem)) return ASTRO_ERRORS.badHouse;
  return null;
}

function resolveSolar(input: AstroCastInput): SolarDate | { error: string } {
  if (input.calendar === 'lunar') {
    const solar = lunarToSolar(input.year, input.month, input.day, input.leapMonth);
    if (!solar) return { error: ASTRO_ERRORS.badLunar };
    return solar;
  }
  if (!isGregorian(input.year, input.month, input.day)) return { error: ASTRO_ERRORS.badDate };
  return { year: input.year, month: input.month, day: input.day };
}

function isGregorian(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

interface DrawTime {
  jdUt: number;
  zone: string;
  offsetMinutes: number;
  dst: boolean;
  utc: UTResult['utc'];
  status: 'ok' | 'chosen' | 'shifted';
  dstChoice: AstroDstChoice | null;
  shiftedLocal?: string;
}

function draw(input: AstroCastInput, solar: SolarDate, time: DrawTime): AstroCastResult {
  let chart: Chart;
  try {
    chart = getEngine().chartAt(time.jdUt, input.latitude, input.longitude, input.houseSystem as HouseSystem);
  } catch {
    return { ok: false, error: ASTRO_ERRORS.failed };
  }

  const warnings = chart.warnings.map(warningText).filter(item => item.length > 0);
  const unavailable = chart.unavailable.map(id => {
    const name = bodyName(id);
    return name ? `${name}不在这次数据范围内，没有放进星盘。` : '';
  }).filter(item => item.length > 0);

  const planets = BODY_ORDER.map(id => {
    const body = chart.bodies[id];
    return body ? toPoint(id, body.lon, body) : null;
  }).filter((item): item is AstroPointView => !!item);

  const asc = toAngle('asc', chart.angles.asc, '上升');
  const mc = toAngle('mc', chart.angles.mc, '天顶');
  const dsc = toAngle('dsc', (chart.angles.asc + 180) % 360, '下降');
  const ic = toAngle('ic', (chart.angles.mc + 180) % 360, '天底');
  const cusps = chart.cusps.map((lon, index): AstroCuspView => {
    const sign = signFromLongitude(lon);
    const house = index + 1;
    const signDegText = formatSignDegree(sign.signDeg);
    return {
      house,
      lon,
      sign: sign.sign,
      signDegText,
      text: `第${house}宫 ${sign.sign} ${signDegText}`,
    };
  });
  const aspects = chart.aspects.map(toAspect).filter((item): item is AstroAspectView => !!item);
  const offsetLabel = formatOffset(time.offsetMinutes);
  const localText = clockText(solar.year, solar.month, solar.day, input.hour, input.minute, 0);
  const utcText = `${clockText(time.utc.year, time.utc.month, time.utc.day, time.utc.hour, time.utc.minute, time.utc.second)} 世界时`;
  const calendarNote = input.calendar === 'lunar'
    ? `农历 ${input.year}年${input.month}月${input.day}日${input.leapMonth ? '（闰月）' : ''}已换成公历 ${solar.year}-${String(solar.month).padStart(2, '0')}-${String(solar.day).padStart(2, '0')}。星盘按换算后的公历钟面计算。`
    : '按公历钟面时间计算。';

  let transits: AstroTransitView | null = null;
  try {
    transits = buildTransits(chart, input.transitUtc);
  } catch {
    warnings.push('行运这一次没有算出，本命盘仍然有效。');
  }

  const view: AstroChartView = {
    engineName: 'caelus',
    engineVersion: VERSION,
    houseSystem: chart.houseSystem as AstroHouseSystem,
    houseSystemLabel: houseLabel(chart.houseSystem),
    requestedHouseSystem: input.houseSystem,
    requestedHouseSystemLabel: houseLabel(input.houseSystem),
    polarFallback: chart.houseSystem !== input.houseSystem,
    zodiacLabel: '热带黄道',
    latitude: input.latitude,
    longitude: input.longitude,
    placeText: `${formatLat(input.latitude)}，${formatLon(input.longitude)}`,
    zone: time.zone,
    offsetLabel,
    dst: time.dst,
    timeStatus: time.status,
    timeNote: buildTimeNote(time, offsetLabel),
    calendarNote,
    localText,
    utcText,
    ascendant: asc,
    midheaven: mc,
    descendant: dsc,
    imumCoeli: ic,
    planets,
    cusps,
    aspects,
    warnings,
    unavailable,
    transits,
  };
  return { ok: true, chart: view };
}

function buildTimeNote(time: DrawTime, offsetLabel: string): string {
  const season = time.dst ? '这次钟面落在夏令时。' : '这次不是夏令时。';
  const method = `时区 ${time.zone}，时差 ${offsetLabel}。${season}星盘用钟面时间加这个时差换成世界时。真太阳时开关不参与这次计算。`;
  if (time.status === 'chosen') {
    const which = time.dstChoice === 'later' ? '较晚' : '较早';
    const kind = time.dst ? '夏令时' : '标准时';
    return `这个钟面在 ${time.zone} 出现了两次，你选的是${which}的一次（${offsetLabel}，${kind}）。${method}`;
  }
  if (time.status === 'shifted') {
    return `钟面时间在 ${time.zone} 不存在，夏令时把这一小时拨过去了。星盘用拨快后的时刻（当地 ${time.shiftedLocal ?? ''}，${offsetLabel}）。${method}`;
  }
  return method;
}

function toPoint(id: string, lon: number, body: ChartBody): AstroPointView | null {
  const name = bodyName(id);
  const short = bodyShort(id);
  if (!name || !short) return null;
  const sign = signLabel(lon, body.sign);
  const signDegText = formatSignDegree(signFromLongitude(lon).signDeg);
  const dignities = dignityLabel(body.dignities);
  const retro = body.retrograde ? ' 逆行' : '';
  return {
    id,
    name,
    short,
    lon,
    sign,
    signDegText,
    house: body.house,
    retrograde: body.retrograde,
    dignities,
    text: `${name} ${sign} ${signDegText} 第${body.house}宫${retro}`,
  };
}

function toAngle(id: string, lon: number, name: string): AstroPointView {
  const sign = signFromLongitude(lon);
  const signDegText = formatSignDegree(sign.signDeg);
  return {
    id,
    name,
    short: name.slice(0, 1),
    lon,
    sign: sign.sign,
    signDegText,
    house: null,
    retrograde: false,
    dignities: '—',
    text: `${name} ${sign.sign} ${signDegText}`,
  };
}

function toAspect(aspect: Chart['aspects'][number]): AstroAspectView | null {
  const aName = bodyName(aspect.a);
  const bName = bodyName(aspect.b);
  const name = aspectLabel(aspect.aspect);
  const phase = phaseLabel(aspect.phase);
  if (!aName || !bName || !name || !phase) return null;
  const orbText = formatOrb(aspect.orb);
  return {
    a: aspect.a,
    b: aspect.b,
    aName,
    bName,
    name,
    orb: aspect.orb,
    orbText,
    phase,
    text: `${aName} ${name} ${bName} 容许 ${orbText} ${phase}`,
  };
}

function buildTransits(natal: Chart, transitUtc: string | null | undefined): AstroTransitView {
  const moment = transitMoment(transitUtc);
  const jd = julianDay(moment.year, moment.month, moment.day, moment.hour, moment.minute, moment.second);
  const engine = getEngine();
  const bodies = transitHouses(natal, engine, jd).map(item => {
    const name = bodyName(item.body);
    if (!name) return null;
    const sign = signFromLongitude(item.lon);
    const signDegText = formatSignDegree(sign.signDeg);
    return {
      id: item.body,
      name,
      sign: sign.sign,
      signDegText,
      house: item.house,
      text: `行运${name} ${sign.sign} ${signDegText} 落在本命第${item.house}宫`,
    };
  }).filter((item): item is AstroTransitView['bodies'][number] => !!item);

  const aspects = transitAspects(natal, engine, jd)
    .map(hit => {
      const moving = bodyName(hit.transit);
      const natalName = bodyName(hit.natal);
      const name = aspectLabel(hit.aspect);
      const phase = phaseLabel(hit.phase);
      if (!moving || !natalName || !name || !phase) return null;
      return {
        orb: hit.orb,
        text: `行运${moving} ${name} 本命${natalName} 容许 ${formatOrb(hit.orb)} ${phase}`,
      };
    })
    .filter((item): item is { orb: number; text: string } => !!item)
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 24);

  return {
    utcText: `${clockText(moment.year, moment.month, moment.day, moment.hour, moment.minute, moment.second)} 世界时`,
    bodies,
    aspects,
  };
}

function transitMoment(value: string | null | undefined): SolarDate & { hour: number; minute: number; second: number } {
  const parsed = value ? new Date(value) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const year = date.getUTCFullYear();
  if (year < 1000 || year > 3000) {
    const now = new Date();
    return {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      day: now.getUTCDate(),
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      second: now.getUTCSeconds(),
    };
  }
  return {
    year,
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function warningText(warning: ChartWarning): string {
  if (warning.kind === 'outside_validated_range') {
    const name = bodyName(warning.body);
    if (!name) return '';
    return `${name}这一刻超出库里的校验年份（${warning.validated.from}–${warning.validated.to}），位置仍会画出，但不要把它当成已校验。`;
  }
  return `这个历史时刻换算世界时的误差大约 ${Math.round(warning.sigmaSeconds)} 秒，上升点可能因此摆动约 ${warning.angleSmearDeg.toFixed(2)}°。`;
}

function dstOptions(candidates: UTCandidate[]): NonNullable<AstroPrompt['options']> {
  const sorted = [...candidates].sort((a, b) => a.jdUt - b.jdUt).slice(0, 2);
  return sorted.map((candidate, index) => ({
    id: index === 0 ? 'earlier' : 'later',
    offsetLabel: formatOffset(candidate.offsetMinutes),
    dst: candidate.dst,
    utcText: jdToUtcText(candidate.jdUt),
  }));
}

function jdToUtcText(jdUt: number): string {
  const utc = utcFromJd(jdUt);
  return clockText(utc.year, utc.month, utc.day, utc.hour, utc.minute, utc.second);
}

function utcFromJd(jdUt: number): UTResult['utc'] {
  return utcParts((jdUt - 2440587.5) * 86_400_000);
}

function utcParts(ms: number): UTResult['utc'] {
  const date = new Date(ms);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function localFromUtc(utc: UTResult['utc'], offsetMinutes: number): string {
  const ms = Date.UTC(utc.year, utc.month - 1, utc.day, utc.hour, utc.minute, utc.second) + offsetMinutes * 60_000;
  return clockTextFromMs(ms);
}

function clockTextFromMs(ms: number): string {
  const date = new Date(ms);
  return clockText(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  );
}
