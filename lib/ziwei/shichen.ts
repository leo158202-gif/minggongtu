/** 钟面时间加经度差后的时辰。经度 120 时校正为 0，和出生表单原来的算法相同。 */
export function shichenIndex(clockHour: number, clockMinute: number, longitude = 120): number {
  const clockMins = clockHour * 60 + clockMinute;
  const solar = ((clockMins + (longitude - 120) * 4) % 1440 + 1440) % 1440;
  if (solar >= 1380 || solar < 60) return 0;
  return Math.floor((solar - 60) / 120) + 1;
}
