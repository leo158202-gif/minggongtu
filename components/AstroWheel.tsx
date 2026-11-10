import type { AstroChartView } from '@/lib/astro/types';
import { SIGN_ZH } from '@/lib/astro/labels';
import { cuspMidpoint, planetSlots, wheelPoint } from '@/lib/astro/wheel';

const CX = 320;
const CY = 320;

export default function AstroWheel({ chart }: { chart: AstroChartView }) {
  const asc = chart.ascendant.lon;
  const slots = planetSlots(chart.planets.map(planet => planet.lon));
  return (
    <svg className="astro-wheel" viewBox="-36 -36 712 712" role="img" aria-label="本命星盘，上升在左侧" data-testid="astro-wheel">
      <circle cx={CX} cy={CY} r={300} fill="var(--t-bg)" stroke="var(--t-border)" />
      {SIGN_ZH.map((sign, index) => {
        const start = index * 30;
        const end = start + 30;
        const label = wheelPoint(start + 15, asc, 274, CX, CY);
        return (
          <g key={sign}>
            <path d={sectorPath(asc, start, end, 248, 300)} fill={index % 2 === 0 ? 'var(--ac-bg)' : 'transparent'} stroke="var(--t-border)" />
            <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" fill="var(--t-gold)" fontSize="13">{sign}</text>
          </g>
        );
      })}
      <circle cx={CX} cy={CY} r={248} fill="none" stroke="var(--t-border-acc)" />
      {chart.cusps.map((cusp, index) => {
        const outer = wheelPoint(cusp.lon, asc, 248, CX, CY);
        const inner = wheelPoint(cusp.lon, asc, 118, CX, CY);
        const next = chart.cusps[(index + 1) % chart.cusps.length];
        const number = wheelPoint(cuspMidpoint(cusp.lon, next.lon), asc, 226, CX, CY);
        const emphasized = index === 0 || index === 9;
        return (
          <g key={cusp.house}>
            <line
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={emphasized ? 'var(--t-gold)' : 'var(--t-border)'}
              strokeWidth={emphasized ? 1.6 : 1}
            />
            <text x={number.x} y={number.y} textAnchor="middle" dominantBaseline="central" fill="var(--t-faint)" fontSize="11">{cusp.house}</text>
          </g>
        );
      })}
      {chart.aspects.map(aspect => {
        const a = chart.planets.find(planet => planet.id === aspect.a);
        const b = chart.planets.find(planet => planet.id === aspect.b);
        if (!a || !b) return null;
        const p1 = wheelPoint(a.lon, asc, 132, CX, CY);
        const p2 = wheelPoint(b.lon, asc, 132, CX, CY);
        return (
          <line
            key={`${aspect.a}-${aspect.name}-${aspect.b}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={aspectColor(aspect.name)}
            strokeWidth="1"
            opacity={0.28 + Math.min(1, Math.max(0, aspect.orb === 0 ? 1 : 1 - aspect.orb / 8)) * 0.45}
          />
        );
      })}
      <circle cx={CX} cy={CY} r={132} fill="none" stroke="var(--t-border)" />
      {chart.planets.map((planet, index) => {
        const at = wheelPoint(planet.lon, asc, 196 - slots[index] * 16, CX, CY);
        return (
          <text
            key={planet.id}
            x={at.x}
            y={at.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--t-text)"
            fontSize="13"
            stroke="var(--t-bg)"
            strokeWidth="3"
            paintOrder="stroke"
          >
            {planet.retrograde ? `${planet.short}逆` : planet.short}
          </text>
        );
      })}
      <AngleLabel lon={chart.ascendant.lon} asc={asc} text="上升" />
      <AngleLabel lon={chart.midheaven.lon} asc={asc} text="天顶" />
    </svg>
  );
}

function AngleLabel({ lon, asc, text }: { lon: number; asc: number; text: string }) {
  const at = wheelPoint(lon, asc, 332, CX, CY);
  return (
    <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="central" fill="var(--t-gold)" fontSize="12">{text}</text>
  );
}

function sectorPath(asc: number, start: number, end: number, inner: number, outer: number): string {
  const outerStart = wheelPoint(start, asc, outer, CX, CY);
  const outerEnd = wheelPoint(end, asc, outer, CX, CY);
  const innerEnd = wheelPoint(end, asc, inner, CX, CY);
  const innerStart = wheelPoint(start, asc, inner, CX, CY);
  return `M ${outerStart.x} ${outerStart.y} A ${outer} ${outer} 0 0 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${inner} ${inner} 0 0 0 ${innerStart.x} ${innerStart.y} Z`;
}

function aspectColor(name: string): string {
  if (name === '合相') return 'var(--t-gold)';
  if (name === '三分') return 'var(--lu)';
  if (name === '六分') return 'var(--quan)';
  return 'var(--ji)';
}
