import { ASTRO_ERRORS } from './errors';
import type { AstroCastInput, AstroCastResult, AstroChartView, AstroPrompt } from './types';

/** 浏览器只向本站要结果，不把星历库打进紫微和八字页面。 */
export async function requestAstroChart(input: AstroCastInput): Promise<AstroCastResult> {
  let response: Response;
  try {
    response = await fetch('/api/astro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, error: ASTRO_ERRORS.network };
  }
  const data: unknown = await response.json().catch(() => null);
  if (!isRecord(data)) return { ok: false, error: ASTRO_ERRORS.network };
  if (data.ok === true && isChart(data.chart)) return { ok: true, chart: data.chart };
  const error = typeof data.error === 'string' && data.error.trim() && data.error.length <= 240
    ? data.error.trim()
    : ASTRO_ERRORS.network;
  return { ok: false, error, prompt: isPrompt(data.prompt) ? data.prompt : undefined };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isChart(value: unknown): value is AstroChartView {
  if (!isRecord(value)) return false;
  const asc = value.ascendant;
  return value.engineName === 'caelus'
    && isRecord(asc)
    && typeof asc.lon === 'number'
    && typeof asc.text === 'string'
    && Array.isArray(value.planets)
    && Array.isArray(value.cusps)
    && Array.isArray(value.aspects);
}

function isPrompt(value: unknown): value is AstroPrompt {
  if (!isRecord(value)) return false;
  return value.kind === 'ambiguous' || value.kind === 'nonexistent';
}
