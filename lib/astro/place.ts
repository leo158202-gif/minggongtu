import type { AstroHouseSystem, AstroPlaceState } from './types';

export interface AstroCity {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  zone: string;
}

/** 城市中心的约数，不是出生医院的测量点。中国大陆条目默认北京时间。 */
export const ASTRO_CITIES: AstroCity[] = [
  { id: 'beijing', name: '北京', latitude: 39.9042, longitude: 116.4074, zone: 'Asia/Shanghai' },
  { id: 'shanghai', name: '上海', latitude: 31.2304, longitude: 121.4737, zone: 'Asia/Shanghai' },
  { id: 'guangzhou', name: '广州', latitude: 23.1291, longitude: 113.2644, zone: 'Asia/Shanghai' },
  { id: 'shenzhen', name: '深圳', latitude: 22.5431, longitude: 114.0579, zone: 'Asia/Shanghai' },
  { id: 'chengdu', name: '成都', latitude: 30.5728, longitude: 104.0668, zone: 'Asia/Shanghai' },
  { id: 'hangzhou', name: '杭州', latitude: 30.2741, longitude: 120.1551, zone: 'Asia/Shanghai' },
  { id: 'xian', name: '西安', latitude: 34.3416, longitude: 108.9398, zone: 'Asia/Shanghai' },
  { id: 'wuhan', name: '武汉', latitude: 30.5928, longitude: 114.3055, zone: 'Asia/Shanghai' },
  { id: 'chongqing', name: '重庆', latitude: 29.563, longitude: 106.5516, zone: 'Asia/Shanghai' },
  { id: 'urumqi-beijing', name: '乌鲁木齐（北京时间）', latitude: 43.8256, longitude: 87.6168, zone: 'Asia/Shanghai' },
  { id: 'urumqi-local', name: '乌鲁木齐（乌鲁木齐时间）', latitude: 43.8256, longitude: 87.6168, zone: 'Asia/Urumqi' },
  { id: 'hongkong', name: '香港', latitude: 22.3193, longitude: 114.1694, zone: 'Asia/Hong_Kong' },
  { id: 'taipei', name: '台北', latitude: 25.033, longitude: 121.5654, zone: 'Asia/Taipei' },
  { id: 'tokyo', name: '东京', latitude: 35.6762, longitude: 139.6503, zone: 'Asia/Tokyo' },
  { id: 'singapore', name: '新加坡', latitude: 1.3521, longitude: 103.8198, zone: 'Asia/Singapore' },
  { id: 'london', name: '伦敦', latitude: 51.5074, longitude: -0.1278, zone: 'Europe/London' },
  { id: 'paris', name: '巴黎', latitude: 48.8566, longitude: 2.3522, zone: 'Europe/Paris' },
  { id: 'newyork', name: '纽约', latitude: 40.7128, longitude: -74.006, zone: 'America/New_York' },
  { id: 'chicago', name: '芝加哥', latitude: 41.8781, longitude: -87.6298, zone: 'America/Chicago' },
  { id: 'losangeles', name: '洛杉矶', latitude: 34.0522, longitude: -118.2437, zone: 'America/Los_Angeles' },
  { id: 'sydney', name: '悉尼', latitude: -33.8688, longitude: 151.2093, zone: 'Australia/Sydney' },
  { id: 'auckland', name: '奥克兰', latitude: -36.8509, longitude: 174.7645, zone: 'Pacific/Auckland' },
];

export const ASTRO_ZONES: { id: string; label: string }[] = [
  { id: 'Asia/Shanghai', label: '北京时间' },
  { id: 'Asia/Urumqi', label: '乌鲁木齐时间' },
  { id: 'Asia/Hong_Kong', label: '香港时间' },
  { id: 'Asia/Taipei', label: '台北时间' },
  { id: 'Asia/Tokyo', label: '东京时间' },
  { id: 'Asia/Singapore', label: '新加坡时间' },
  { id: 'Europe/London', label: '伦敦时间' },
  { id: 'Europe/Paris', label: '巴黎时间' },
  { id: 'America/New_York', label: '纽约时间' },
  { id: 'America/Chicago', label: '芝加哥时间' },
  { id: 'America/Los_Angeles', label: '洛杉矶时间' },
  { id: 'Australia/Sydney', label: '悉尼时间' },
  { id: 'Pacific/Auckland', label: '奥克兰时间' },
  { id: 'UTC', label: '世界时 UTC' },
];

export const DEFAULT_ASTRO_PLACE: AstroPlaceState = {
  latitude: '39.9042',
  longitude: '116.4074',
  zoneChoice: 'Asia/Shanghai',
  customZone: '',
  dstChoice: null,
  acceptGapKey: null,
  houseSystem: 'placidus',
};

export function resolvedZone(place: AstroPlaceState): string {
  if (place.zoneChoice === 'custom') return place.customZone.trim();
  return place.zoneChoice.trim();
}

export function astroGapKey(input: {
  calendar: 'solar' | 'lunar';
  leapMonth: boolean;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  zone: string;
  latitude: string;
  longitude: string;
}): string {
  return [
    input.calendar,
    input.leapMonth ? 1 : 0,
    input.year,
    input.month,
    input.day,
    input.hour,
    input.minute,
    input.zone,
    input.latitude.trim(),
    input.longitude.trim(),
  ].join('|');
}

const BIRTH_CITY_ALIAS: Record<string, string> = {
  乌鲁木齐: 'urumqi-beijing',
};

/** 出生地表单只有经度。名称能对上预设时，占星用该预设的纬度和民用时区。 */
export function presetForBirthCity(city: string | undefined): AstroCity | null {
  if (!city) return null;
  const alias = BIRTH_CITY_ALIAS[city];
  if (alias) return ASTRO_CITIES.find(item => item.id === alias) ?? null;
  return ASTRO_CITIES.find(item => item.name === city) ?? null;
}

export function readCoords(latitudeText: string, longitudeText: string): { latitude: number; longitude: number } | null {
  const latitude = Number(latitudeText.trim());
  const longitude = Number(longitudeText.trim());
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function isHouseSystem(value: string): value is AstroHouseSystem {
  return value === 'placidus' || value === 'whole_sign' || value === 'equal' || value === 'koch';
}
