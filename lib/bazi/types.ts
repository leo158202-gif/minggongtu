export type BaziSchool = 'ziwei' | 'bazi';
export type BaziCalendar = 'solar' | 'lunar';
export type BaziSect = 1 | 2;

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
  decades: BaziDecadeView[];
  startYun: string;
  dstApplied: boolean;
  dstMinutes: number | null;
  trueSolarMinutes: number | null;
  trueSolarSource: string;
  sectLabel: string;
  calendarLabel: string;
}

export interface BaziAiContext {
  school: 'bazi';
  readingTarget: string;
  calendarLabel: string;
  sectLabel: string;
  trueSolar: boolean;
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
