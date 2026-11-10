/** 西洋占星预览的页面模型和追问上下文。这里不引用计算库。 */

export const ASTRO_HOUSE_SYSTEMS = ['placidus', 'whole_sign', 'equal', 'koch'] as const;
export type AstroHouseSystem = (typeof ASTRO_HOUSE_SYSTEMS)[number];
export type AstroDstChoice = 'earlier' | 'later';

export interface AstroPlaceState {
  latitude: string;
  longitude: string;
  /** `auto` 按经纬度判断，`custom` 用 customZone，其余是 IANA 时区。 */
  zoneChoice: string;
  customZone: string;
  dstChoice: AstroDstChoice | null;
  /** 与某一次钟面时间绑定。换日期或地点后对不上，就不会沿用拨快。 */
  acceptGapKey: string | null;
  houseSystem: AstroHouseSystem;
}

export interface AstroCastInput {
  calendar: 'solar' | 'lunar';
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  leapMonth: boolean;
  timeUnknown: boolean;
  latitude: number;
  longitude: number;
  /** `auto` 或 IANA 时区名。 */
  zone: string;
  dstChoice: AstroDstChoice | null;
  acceptGap: boolean;
  houseSystem: AstroHouseSystem;
  /** 缺省用服务器当前世界时。测试可传入固定时刻。 */
  transitUtc?: string | null;
}

export interface AstroPointView {
  id: string;
  name: string;
  short: string;
  lon: number;
  sign: string;
  signDegText: string;
  house: number | null;
  retrograde: boolean;
  dignities: string;
  text: string;
}

export interface AstroCuspView {
  house: number;
  lon: number;
  sign: string;
  signDegText: string;
  text: string;
}

export interface AstroAspectView {
  a: string;
  b: string;
  aName: string;
  bName: string;
  name: string;
  orb: number;
  orbText: string;
  phase: string;
  text: string;
}

export interface AstroTransitBodyView {
  id: string;
  name: string;
  sign: string;
  signDegText: string;
  house: number;
  text: string;
}

export interface AstroTransitAspectView {
  text: string;
  orb: number;
}

export interface AstroTransitView {
  utcText: string;
  bodies: AstroTransitBodyView[];
  aspects: AstroTransitAspectView[];
}

export interface AstroChartView {
  engineName: 'caelus';
  engineVersion: string;
  houseSystem: AstroHouseSystem;
  houseSystemLabel: string;
  requestedHouseSystem: AstroHouseSystem;
  requestedHouseSystemLabel: string;
  polarFallback: boolean;
  zodiacLabel: string;
  latitude: number;
  longitude: number;
  placeText: string;
  zone: string;
  offsetLabel: string;
  dst: boolean;
  timeStatus: 'ok' | 'chosen' | 'shifted';
  timeNote: string;
  calendarNote: string;
  localText: string;
  utcText: string;
  ascendant: AstroPointView;
  midheaven: AstroPointView;
  descendant: AstroPointView;
  imumCoeli: AstroPointView;
  planets: AstroPointView[];
  cusps: AstroCuspView[];
  aspects: AstroAspectView[];
  warnings: string[];
  unavailable: string[];
  transits: AstroTransitView | null;
}

export interface AstroDstOption {
  id: AstroDstChoice;
  offsetLabel: string;
  dst: boolean;
  utcText: string;
}

export interface AstroPrompt {
  kind: 'ambiguous' | 'nonexistent';
  zone: string;
  options?: AstroDstOption[];
  shiftedLocalText?: string;
  shiftedUtcText?: string;
  offsetLabel?: string;
}

export type AstroCastResult =
  | { ok: true; chart: AstroChartView }
  | { ok: false; error: string; prompt?: AstroPrompt };

export interface AstroAiContext {
  school: 'astro';
  readingTarget: string;
  timeNote: string;
  calendarNote: string;
  placeText: string;
  houseSystem: string;
  polarFallback: string;
  ascendant: string;
  midheaven: string;
  descendant: string;
  imumCoeli: string;
  planets: string[];
  cusps: string[];
  aspects: string[];
  transits: string[];
  warnings: string[];
  limits: string;
}
