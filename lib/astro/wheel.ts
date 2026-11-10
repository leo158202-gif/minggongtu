/** 星盘几何。上升放在左侧，黄经增加的方向为逆时针（从左侧走向下方）。 */

export function wheelPoint(lon: number, asc: number, radius: number, cx = 0, cy = 0): { x: number; y: number } {
  const angle = ((180 + (lon - asc)) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy - radius * Math.sin(angle),
  };
}

function angularDistance(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return Math.min(raw, 360 - raw);
}

/** 黄经太近的星向外错开，避免字叠在一起。返回与输入同序的圈层。 */
export function planetSlots(longitudes: number[], gap = 10): number[] {
  const order = longitudes
    .map((lon, index) => ({ lon: ((lon % 360) + 360) % 360, index }))
    .sort((a, b) => a.lon - b.lon);
  const slots = new Array<number>(longitudes.length).fill(0);
  const placed: { lon: number; slot: number }[] = [];
  for (const item of order) {
    let slot = 0;
    while (placed.some(point => point.slot === slot && angularDistance(point.lon, item.lon) < gap)) {
      slot += 1;
      if (slot > 4) break;
    }
    placed.push({ lon: item.lon, slot });
    slots[item.index] = slot;
  }
  return slots;
}

export function cuspMidpoint(start: number, end: number): number {
  const span = (end - start + 360) % 360 || 360;
  return (start + span / 2) % 360;
}
