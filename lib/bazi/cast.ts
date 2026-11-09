/**
 * 八字只调用 xuantian-bazi@0.2.0 一次。
 * 传入的 birthTime 必须是用户填写的钟面时间。真太阳时、夏令时由库内部做，这里不再预平移。
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
  BaziYearView,
} from './types';

const PILLAR_TYPES = ['year', 'month', 'day', 'hour'] as const;

export function castBazi(input: BaziCastInput): BaziChartView {
  const longitude = input.trueSolar ? (input.longitude ?? 120) : undefined;
  let result: ChartResult;
  try {
    result = calculateChart({
      gender: input.gender,
      calendar: input.calendar,
      birthDate: input.birthDate,
      birthTime: input.birthTime,
      leapMonth: input.calendar === 'lunar' ? input.leapMonth : false,
      sect: input.sect,
      trueSolarTime: input.trueSolar,
      timeZone: 'Asia/Shanghai',
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
    assumedMeridian120: input.trueSolar && input.longitude === undefined,
    longitude: longitude ?? null,
  });
}

function toView(
  result: ChartResult,
  input: BaziCastInput,
  meta: { version: string; assumedMeridian120: boolean; longitude: number | null },
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
    dstApplied: corrections.dst_applied === true || dst.dstApplied === true,
    dstMinutes: numberOrNull(dst.dstMinutes ?? corrections.dst_minutes),
    trueSolarMinutes: numberOrNull(trueSolar.correctionMinutes ?? corrections.true_solar_correction_minutes),
    trueSolarSource: text(trueSolar.source || corrections.true_solar_source),
    sectLabel: input.sect === 1 ? '23:00 起日柱算次日' : '23:00–23:59 日柱仍算当天',
    calendarLabel: input.calendar === 'lunar' ? (input.leapMonth ? '农历闰月' : '农历') : '公历',
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
