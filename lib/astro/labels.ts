/** 计算库给出英文星名和相位名。页面和追问只用这里的中文。 */

export const SIGN_ZH = [
  '白羊', '金牛', '双子', '巨蟹', '狮子', '处女',
  '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼',
] as const;

const SIGN_FROM_ENGLISH: Record<string, string> = {
  Aries: '白羊',
  Taurus: '金牛',
  Gemini: '双子',
  Cancer: '巨蟹',
  Leo: '狮子',
  Virgo: '处女',
  Libra: '天秤',
  Scorpio: '天蝎',
  Sagittarius: '射手',
  Capricorn: '摩羯',
  Aquarius: '水瓶',
  Pisces: '双鱼',
};

export const BODY_ZH: Record<string, { name: string; short: string }> = {
  sun: { name: '太阳', short: '日' },
  moon: { name: '月亮', short: '月' },
  mercury: { name: '水星', short: '水' },
  venus: { name: '金星', short: '金' },
  mars: { name: '火星', short: '火' },
  jupiter: { name: '木星', short: '木' },
  saturn: { name: '土星', short: '土' },
  uranus: { name: '天王星', short: '天' },
  neptune: { name: '海王星', short: '海' },
  pluto: { name: '冥王星', short: '冥' },
  chiron: { name: '凯龙', short: '凯' },
  true_node: { name: '北交点', short: '北' },
  mean_node: { name: '平北交', short: '平' },
};

export const BODY_ORDER = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto', 'chiron', 'true_node', 'mean_node',
] as const;

const ASPECT_ZH: Record<string, string> = {
  conjunction: '合相',
  sextile: '六分',
  square: '四分',
  trine: '三分',
  opposition: '对分',
};

const PHASE_ZH: Record<string, string> = {
  applying: '入相',
  separating: '出相',
  exact: '精确',
};

const DIGNITY_ZH: Record<string, string> = {
  domicile: '入庙',
  exaltation: '擢升',
  detriment: '失势',
  fall: '落陷',
};

export const HOUSE_LABEL: Record<string, string> = {
  placidus: '普拉西德',
  whole_sign: '整宫',
  equal: '等宫',
  koch: '柯赫',
  porphyry: '波菲里',
  regiomontanus: '雷格蒙塔努斯',
  campanus: '坎帕纳斯',
  alcabitius: '阿卡比特',
  morinus: '莫林',
  meridian: '子午线',
  polich_page: '波利希-佩奇',
  vehlow: '韦洛',
};

export function bodyName(id: string): string {
  return BODY_ZH[id]?.name ?? '';
}

export function bodyShort(id: string): string {
  return BODY_ZH[id]?.short ?? '';
}

export function signFromLongitude(lon: number): { sign: string; signDeg: number } {
  const norm = ((lon % 360) + 360) % 360;
  const index = Math.min(11, Math.floor(norm / 30));
  return { sign: SIGN_ZH[index], signDeg: norm - index * 30 };
}

/** 中文星座以黄经为准。英文名只做对照，对不上时不用它。 */
export function signLabel(lon: number, english?: string): string {
  const fromLon = signFromLongitude(lon).sign;
  if (!english) return fromLon;
  const mapped = SIGN_FROM_ENGLISH[english];
  return mapped === fromLon ? fromLon : fromLon;
}

export function formatSignDegree(signDeg: number): string {
  const safe = Math.min(Math.max(signDeg, 0), 29.999999);
  const total = Math.round(safe * 60);
  let deg = Math.floor(total / 60);
  let min = total % 60;
  if (deg >= 30) {
    deg = 29;
    min = 59;
  }
  return `${deg}°${String(min).padStart(2, '0')}′`;
}

export function formatOrb(orb: number): string {
  const total = Math.round(Math.abs(orb) * 60);
  const deg = Math.floor(total / 60);
  const min = total % 60;
  return `${deg}°${String(min).padStart(2, '0')}′`;
}

export function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = Math.round(abs - hours * 60);
  if (mins === 60) return `UTC${sign}${hours + 1}`;
  if (mins === 0) return `UTC${sign}${hours}`;
  return `UTC${sign}${hours}:${String(mins).padStart(2, '0')}`;
}

export function formatLat(lat: number): string {
  return `${lat >= 0 ? '北纬' : '南纬'} ${Math.abs(lat).toFixed(2)}°`;
}

export function formatLon(lon: number): string {
  return `${lon >= 0 ? '东经' : '西经'} ${Math.abs(lon).toFixed(2)}°`;
}

export function aspectLabel(name: string): string {
  return ASPECT_ZH[name] ?? '';
}

export function phaseLabel(phase: string): string {
  return PHASE_ZH[phase] ?? '';
}

export function dignityLabel(ids: string[]): string {
  const labels = ids.map(id => DIGNITY_ZH[id]).filter((item): item is string => !!item);
  return labels.length ? labels.join('、') : '—';
}

export function houseLabel(system: string): string {
  return HOUSE_LABEL[system] ?? system;
}

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function clockText(year: number, month: number, day: number, hour: number, minute: number, second = 0): string {
  return `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}
