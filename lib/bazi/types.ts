export type BaziSchool = 'ziwei' | 'bazi';
export type BaziCalendar = 'solar' | 'lunar';
export type BaziSect = 1 | 2;
/** standard：钟面已是标准北京时间 UTC+8。wall：钟面是出生地当年的原始时间，历史夏令时按当时的时差。 */
export type BaziTimeBasis = 'standard' | 'wall';

export interface BaziCastInput {
  gender: 'male' | 'female';
  calendar: BaziCalendar;
  /** YYYY-MM-DD，公历或农历都用这一个字段，由 calendar 区分。 */
  birthDate: string;
  /** HH:mm，用户填写的钟面时间，不能事先做真太阳时平移。 */
  birthTime: string;
  leapMonth: boolean;
  sect: BaziSect;
  trueSolar: boolean;
  /** 东经。真太阳时关闭时不要传入。 */
  longitude?: number;
  /** 历史夏令时会改变时刻时必须传入。普通日期可以不传，按标准北京时间。 */
  timeBasis?: BaziTimeBasis;
}

export interface BaziHiddenStem {
  gan: string;
  wuXing: string;
  shiShen: string;
}

export interface BaziPillarView {
  type: 'year' | 'month' | 'day' | 'hour';
  label: string;
  ganZhi: string;
  tianGan: string;
  diZhi: string;
  wuXing: string;
  naYin: string;
  mainStar: string;
  cangGan: string[];
  cangGanDetail: BaziHiddenStem[];
  shenSha: string[];
}

export interface BaziYearView {
  year: number;
  ganZhi: string;
  active: boolean;
}

export interface BaziDecadeView {
  label: string;
  startAge: number | null;
  endAge: number | null;
  startYear: number | null;
  endYear: number | null;
  active: boolean;
  mainStar: string;
  years: BaziYearView[];
}

export interface BaziElementView {
  element: string;
  score: number | null;
}

export interface BaziBalanceBar {
  support: number;
  oppose: number;
  supportPct: number;
  opposePct: number;
}

/** 扶抑参考。数值只在和库给出的强弱标签一致时才有。 */
export interface BaziJudgement {
  status: 'known' | 'unknown';
  label: string;
  dayMaster: string;
  element: string;
  season: string;
  root: string;
  support: string;
  seasonNote: string;
  rootNote: string;
  supportNote: string;
  useful: string[];
  unfavorable: string[];
  usefulNote: string;
  caution: string;
  pattern: string;
  /** 库的格局名像从格或专旺时，不把扶抑喜用当成确定结论。 */
  special: boolean;
  bar: BaziBalanceBar | null;
}

export interface BaziChartView {
  engineName: 'xuantian-bazi';
  engineVersion: string;
  gender: 'male' | 'female';
  calendar: BaziCalendar;
  sect: BaziSect;
  trueSolar: boolean;
  assumedMeridian120: boolean;
  longitude: number | null;
  birthDate: string;
  birthTime: string;
  solarDatetime: string;
  chartDatetime: string;
  lunarDatetime: string;
  dayMaster: string;
  dayMasterElement: string;
  zodiac: string;
  pillars: BaziPillarView[];
  fiveElements: BaziElementView[];
  judgement: BaziJudgement;
  decades: BaziDecadeView[];
  startYun: string;
  dstApplied: boolean;
  dstMinutes: number | null;
  trueSolarMinutes: number | null;
  trueSolarSource: string;
  sectLabel: string;
  calendarLabel: string;
  timeBasis: BaziTimeBasis;
  timeBasisLabel: string;
  /** 两种时间依据会差出大约一小时。 */
  timeFork: boolean;
}

export interface BaziAiContext {
  school: 'bazi';
  readingTarget: string;
  calendarLabel: string;
  sectLabel: string;
  trueSolar: boolean;
  timeBasisLabel: string;
  correction: string;
  dayMaster: string;
  dayMasterElement: string;
  pillars: Array<{
    label: string;
    ganZhi: string;
    naYin: string;
    wuXing: string;
    mainStar: string;
    cangGan: string;
  }>;
  fiveElements: string;
  decades: string[];
  selectedDecade: string;
  selectedYear: string;
}
