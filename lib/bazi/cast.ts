/**
 * 八字把钟面交给 xuantian-bazi@0.2.0 一次。
 * 标准北京时间用固定 UTC+8，避免 Asia/Shanghai 再扣历史夏令时。
 * 原始钟面在真太阳时打开时才把 Asia/Shanghai 交给库，由库扣一次历史夏令时并做真太阳时。
 * 原始钟面但真太阳时关闭时，只按两种时区的时刻差预扣一次，之后用固定 UTC+8，不再开真太阳时。
 * 版权与许可证见 ./NOTICE.md。
 */
import { calculateChart, ChartEngineError, getEngineInfo, type ChartResult } from 'xuantian-bazi';
import type {
  BaziCastInput,
  BaziChartView,
  BaziDecadeView,
  BaziElementView,
  BaziHiddenStem,
  BaziPillarView,
  BaziTimeBasis,
  BaziYearView,
} from './types';

const PILLAR_TYPES = ['year', 'month', 'day', 'hour'] as const;
const STANDARD_ZONE = 'Etc/GMT-8';
const WALL_ZONE = 'Asia/Shanghai';

export const BAZI_TIME_BASIS_REQUIRED = '这个钟面落在中国历史夏令时里，两种理解会差 60 分钟。请选择时间依据后再排八字。';

export const BAZI_TIME_BASIS_LABEL: Record<BaziTimeBasis, string> = {
  standard: '已经校准的标准北京时间 UTC+8',
  wall: '当年的原始钟面（按历史夏令时）',
};

export function baziClockForkMinutes(input: BaziCastInput): number {
  try {
    const longitude = input.longitude ?? 120;
    const standard = chartStamp(input, STANDARD_ZONE, input.birthDate, input.birthTime, longitude);
    const wall = chartStamp(input, WALL_ZONE, input.birthDate, input.birthTime, longitude);
    return Math.round((Date.parse(wall) - Date.parse(standard)) / 60_000);
  } catch {
    return 0;
  }
}

export function castBazi(input: BaziCastInput): BaziChartView {
  const forkMinutes = baziClockForkMinutes(input);
  const fork = Math.abs(forkMinutes) >= 30;
  if (fork && input.timeBasis !== 'standard' && input.timeBasis !== 'wall') {
    throw new Error(BAZI_TIME_BASIS_REQUIRED);
  }
  const timeBasis: BaziTimeBasis = input.timeBasis ?? 'standard';
  let birthDate = input.birthDate;
  let birthTime = input.birthTime;
  let timeZone: string = STANDARD_ZONE;
  let trueSolarTime = input.trueSolar;
  let presetDstMinutes: number | null = null;
  if (fork && timeBasis === 'wall') {
    if (input.trueSolar) {
      timeZone = WALL_ZONE;
    } else {
      const shifted = addClockMinutes(input.birthDate, input.birthTime, forkMinutes);
      birthDate = shifted.birthDate;
      birthTime = shifted.birthTime;
      presetDstMinutes = forkMinutes;
      trueSolarTime = false;
    }
  }
  const longitude = trueSolarTime ? (input.longitude ?? 120) : undefined;
  let result: ChartResult;
  try {
    result = calculateChart({
      gender: input.gender,
      calendar: input.calendar,
      birthDate,
      birthTime,
      leapMonth: input.calendar === 'lunar' ? input.leapMonth : false,
      sect: input.sect,
      trueSolarTime,
      timeZone,
      longitude,
      locale: 'zh-CN',
    });
  } catch (error) {
    if (error instanceof ChartEngineError) {
      throw new Error(publicBaziError(error.message));
    }
    throw new Error('八字排盘没有完成，请检查出生日期。');
  }

  const engine = getEngineInfo();
  return toView(result, input, {
    version: engine.version,
    assumedMeridian120: trueSolarTime && input.longitude === undefined,
    longitude: longitude ?? null,
    timeBasis,
    fork,
    presetDstMinutes,
  });
}

function chartStamp(input: BaziCastInput, timeZone: string, birthDate: string, birthTime: string, longitude: number): string {
  return calculateChart({
    gender: input.gender,
    calendar: input.calendar,
    birthDate,
    birthTime,
    leapMonth: input.calendar === 'lunar' ? input.leapMonth : false,
    sect: input.sect,
    trueSolarTime: true,
    timeZone,
    longitude,
    locale: 'zh-CN',
  }).chartDateTime;
}

function addClockMinutes(birthDate: string, birthTime: string, minutes: number): { birthDate: string; birthTime: string } {
  const [year, month, day] = birthDate.split('-').map(Number);
  const [hour, minute] = birthTime.split(':').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day, hour, minute) + minutes * 60_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    birthDate: `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`,
    birthTime: `${pad(next.getUTCHours())}:${pad(next.getUTCMinutes())}`,
  };
}

function toView(
  result: ChartResult,
  input: BaziCastInput,
  meta: {
    version: string;
    assumedMeridian120: boolean;
    longitude: number | null;
    timeBasis: BaziTimeBasis;
    fork: boolean;
    presetDstMinutes: number | null;
  },
): BaziChartView {
  const chart = record(result.normalizedChart);
  const pillars = asArray(chart.pillars).map(readPillar).filter((item): item is BaziPillarView => !!item);
  if (pillars.length !== 4 || pillars.some(item => item.ganZhi.length < 2)) {
    throw new Error('八字库没有返回完整四柱。');
  }
  const corrections = record(result.timeCorrections);
  const trueSolar = record(corrections.true_solar);
  const dst = record(corrections.dst);
  const dayMaster = text(chart.day_master);
  const dayMasterElement = text(chart.day_master_element);
  if (!dayMaster || !dayMasterElement) throw new Error('八字库没有返回日主。');

  return {
    engineName: 'xuantian-bazi',
    engineVersion: meta.version,
    gender: input.gender,
    calendar: input.calendar,
    sect: input.sect,
    trueSolar: input.trueSolar,
    assumedMeridian120: meta.assumedMeridian120,
    longitude: meta.longitude,
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    solarDatetime: result.solarDateTime,
    chartDatetime: result.chartDateTime,
    lunarDatetime: text(chart.lunar_datetime),
    dayMaster,
    dayMasterElement,
    zodiac: text(chart.zodiac),
    pillars,
    fiveElements: asArray(chart.five_elements_summary).map(readElement).filter((item): item is BaziElementView => !!item),
    decades: asArray(chart.decade_cycles).map(readDecade).filter((item): item is BaziDecadeView => !!item),
    startYun: text(chart.start_yun_desc),
    dstApplied: meta.presetDstMinutes !== null || corrections.dst_applied === true || dst.dstApplied === true,
    dstMinutes: meta.presetDstMinutes ?? numberOrNull(dst.dstMinutes ?? corrections.dst_minutes),
    trueSolarMinutes: numberOrNull(trueSolar.correctionMinutes ?? corrections.true_solar_correction_minutes),
    trueSolarSource: text(trueSolar.source || corrections.true_solar_source),
    sectLabel: input.sect === 1 ? '23:00 起日柱算次日' : '23:00–23:59 日柱仍算当天',
    calendarLabel: input.calendar === 'lunar' ? (input.leapMonth ? '农历闰月' : '农历') : '公历',
    timeBasis: meta.timeBasis,
    timeBasisLabel: BAZI_TIME_BASIS_LABEL[meta.timeBasis],
    timeFork: meta.fork,
  };
}

function readPillar(value: unknown, index: number): BaziPillarView | null {
  const item = record(value);
  const ganZhi = text(item.ganZhi || item.displayGanZhi);
  if (!ganZhi) return null;
  const type = PILLAR_TYPES[index] ?? 'year';
  const hidden = asArray(item.cangGanDetail).map(readHidden).filter((stem): stem is BaziHiddenStem => !!stem);
  const cangGan = asArray(item.cangGan).map(text).filter(Boolean);
  return {
    type,
    label: text(item.label) || ['年柱', '月柱', '日柱', '时柱'][index] || '柱',
    ganZhi,
    tianGan: text(item.tianGan) || ganZhi.slice(0, 1),
    diZhi: text(item.diZhi) || ganZhi.slice(1, 2),
    wuXing: text(item.wuXing),
    naYin: text(item.naYin || item.displayNaYin),
    mainStar: text(item.mainStar || item.displayMainStar),
    cangGan: cangGan.length ? cangGan : hidden.map(stem => stem.gan),
    cangGanDetail: hidden,
    shenSha: asArray(item.shenSha).map(text).filter(Boolean),
  };
}

function readHidden(value: unknown): BaziHiddenStem | null {
  const item = record(value);
  const gan = text(item.gan);
  if (!gan) return null;
  return { gan, wuXing: text(item.wuXing), shiShen: text(item.shiShen) };
}

function readElement(value: unknown): BaziElementView | null {
  const item = record(value);
  const element = text(item.element || item.displayElement);
  if (!element) return null;
  const score = typeof item.score === 'number' && Number.isFinite(item.score) ? item.score : null;
  return { element, score };
}

function readDecade(value: unknown): BaziDecadeView | null {
  const item = record(value);
  const years = asArray(item.yearly_cycles).map(readYear).filter((year): year is BaziYearView => !!year);
  const label = text(item.label || item.displayLabel);
  const startAge = intOrNull(item.start_age);
  const endAge = intOrNull(item.end_age);
  if (!label && startAge === null && years.length === 0) return null;
  return {
    label,
    startAge,
    endAge,
    startYear: intOrNull(item.start_year),
    endYear: intOrNull(item.end_year),
    active: item.active === true,
    mainStar: text(item.main_star),
    years,
  };
}

function readYear(value: unknown): BaziYearView | null {
  const item = record(value);
  const year = intOrNull(item.value);
  const ganZhi = text(item.label || item.displayLabel);
  if (year === null || !ganZhi) return null;
  return { year, ganZhi, active: item.active === true };
}

function publicBaziError(message: string): string {
  const textValue = message.replace(/\s+/g, ' ').trim();
  if (!textValue || textValue.length > 160 || /stack|node_modules|at\s+\S+\.(js|ts)/i.test(textValue)) {
    return '这个出生时间排不出八字，请检查日期、闰月和时辰。';
  }
  return textValue
    .replace('birth_date 必须是有效的公历日期', '公历日期不存在')
    .replace('农历 birth_date 日期超出该月实际天数', '这个农历日期不存在')
    .replace('农历 birth_date 的月份或日期无效', '农历月份或日期无效')
    .replace('is_leap_month 仅适用于农历日期', '闰月只用于农历');
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function intOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
  return null;
}
