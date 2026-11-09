'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import BirthForm from '@/components/BirthForm';
import BaziBoard from '@/components/BaziBoard';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel from '@/components/InsightPanel';
import { useTheme } from '@/components/ThemeProvider';
import type { TimeView } from '@/components/TimeNav';
import { buildBaziAiContext } from '@/lib/bazi/ai-context';
import { castBazi } from '@/lib/bazi/cast';
import type { BaziCalendar, BaziChartView, BaziSect } from '@/lib/bazi/types';
import { APP_VERSION, SITE_NAME, UPSTREAM_NOTE, UPSTREAM_URL } from '@/lib/site';
import { generateChart } from '@/lib/ziwei/algorithm';
import { lunarToSolar } from '@/lib/ziwei/lunar-solar';
import { shichenIndex } from '@/lib/ziwei/shichen';
import type { BirthInfo, Palace, ZiweiChart } from '@/lib/ziwei/types';

type School = 'ziwei' | 'bazi';

interface RawBirth {
  year: number;
  month: number;
  day: number;
  clockHour: number;
  clockMinute: number;
  gender: 'male' | 'female';
  name?: string;
  province?: string;
  city?: string;
  longitude?: number;
  calendar: BaziCalendar;
  leapMonth: boolean;
  trueSolar: boolean;
  sect: BaziSect;
  ziweiHour: number;
}

interface CastBundle {
  raw: RawBirth;
  ziwei: ZiweiChart | null;
  ziweiError: string | null;
  bazi: BaziChartView | null;
  baziError: string | null;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function castBoth(raw: RawBirth): CastBundle {
  const birthTime = `${pad(raw.clockHour)}:${pad(raw.clockMinute)}`;
  const birthDate = `${raw.year}-${pad(raw.month)}-${pad(raw.day)}`;
  let solar = { year: raw.year, month: raw.month, day: raw.day };
  let ziweiError: string | null = null;
  if (raw.calendar === 'lunar') {
    const converted = lunarToSolar(raw.year, raw.month, raw.day, raw.leapMonth);
    if (!converted) {
      ziweiError = '这个农历日期不存在，紫微盘没有排。';
    } else {
      solar = converted;
    }
  }

  let ziwei: ZiweiChart | null = null;
  if (!ziweiError) {
    try {
      const info: BirthInfo = {
        year: solar.year,
        month: solar.month,
        day: solar.day,
        hour: raw.ziweiHour,
        gender: raw.gender,
        name: raw.name,
        province: raw.province,
        city: raw.city,
        longitude: raw.longitude,
        origInput: {
          year: raw.year,
          month: raw.month,
          day: raw.day,
          clockHour: raw.clockHour,
          clockMinute: raw.clockMinute,
        },
      };
      ziwei = generateChart(info);
    } catch (error) {
      ziweiError = error instanceof Error ? error.message : '紫微起盘失败，请检查出生日期。';
    }
  }

  let bazi: BaziChartView | null = null;
  let baziError: string | null = null;
  try {
    bazi = castBazi({
      gender: raw.gender,
      calendar: raw.calendar,
      birthDate,
      birthTime,
      leapMonth: raw.leapMonth,
      sect: raw.sect,
      trueSolar: raw.trueSolar,
      longitude: raw.trueSolar ? raw.longitude : undefined,
    });
  } catch (error) {
    baziError = error instanceof Error ? error.message : '八字起盘失败，请检查出生日期。';
  }

  return { raw, ziwei, ziweiError, bazi, baziError };
}

function defaultDecadeIndex(chart: BaziChartView): number {
  const active = chart.decades.findIndex(item => item.active && item.label);
  if (active >= 0) return active;
  const labeled = chart.decades.findIndex(item => item.label);
  return labeled >= 0 ? labeled : 0;
}

function defaultYear(chart: BaziChartView, index: number): number | null {
  const decade = chart.decades[index];
  if (!decade || decade.years.length === 0) return null;
  return (decade.years.find(item => item.active) ?? decade.years[0]).year;
}

export default function ChartWorkspace({ initialSchool = 'ziwei' }: { initialSchool?: School }) {
  const { theme, toggle } = useTheme();
  const [school, setSchool] = useState<School>(initialSchool);
  const [calendar, setCalendar] = useState<BaziCalendar>('solar');
  const [leapMonth, setLeapMonth] = useState(false);
  const [trueSolar, setTrueSolar] = useState(true);
  const [sect, setSect] = useState<BaziSect>(2);
  const [bundle, setBundle] = useState<CastBundle | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [timeView, setTimeView] = useState<TimeView>('mingpan');
  const [liunianYear, setLiunianYear] = useState(() => new Date().getFullYear());
  const [decadeIndex, setDecadeIndex] = useState(0);
  const [flowYear, setFlowYear] = useState<number | null>(null);

  const baziContext = useMemo(
    () => (bundle?.bazi ? buildBaziAiContext(bundle.bazi, decadeIndex, flowYear) : null),
    [bundle, decadeIndex, flowYear],
  );

  const conversationKey = bundle
    ? [
      school,
      bundle.raw.calendar,
      bundle.raw.leapMonth ? 1 : 0,
      bundle.raw.trueSolar ? 1 : 0,
      bundle.raw.sect,
      bundle.raw.year,
      bundle.raw.month,
      bundle.raw.day,
      bundle.raw.clockHour,
      bundle.raw.clockMinute,
      bundle.raw.gender,
      bundle.raw.longitude ?? '',
    ].join('|')
    : `${school}|empty`;

  const applyBundle = (next: CastBundle) => {
    setBundle(next);
    setSelectedPalace(null);
    setTimeView('mingpan');
    setLiunianYear(new Date().getFullYear());
    if (next.bazi) {
      const index = defaultDecadeIndex(next.bazi);
      setDecadeIndex(index);
      setFlowYear(defaultYear(next.bazi, index));
    } else {
      setDecadeIndex(0);
      setFlowYear(null);
    }
  };

  const startChart = (info: BirthInfo) => {
    const clock = info.origInput ?? { year: info.year, month: info.month, day: info.day, clockHour: 0, clockMinute: 0 };
    const raw: RawBirth = {
      year: info.year,
      month: info.month,
      day: info.day,
      clockHour: clock.clockHour,
      clockMinute: clock.clockMinute,
      gender: info.gender,
      name: info.name,
      province: info.province,
      city: info.city,
      longitude: info.longitude,
      calendar,
      leapMonth: calendar === 'lunar' && leapMonth,
      trueSolar,
      sect,
      ziweiHour: info.hour,
    };
    const next = castBoth(raw);
    if (!next.ziwei && !next.bazi) {
      setFormError(next.baziError || next.ziweiError || '起盘失败，请检查出生日期。');
      return;
    }
    setFormError(null);
    applyBundle(next);
  };

  const recastSettings = (patch: Partial<Pick<RawBirth, 'calendar' | 'leapMonth' | 'trueSolar' | 'sect'>>) => {
    if (!bundle) return;
    const raw = { ...bundle.raw, ...patch };
    if (raw.calendar !== 'lunar') raw.leapMonth = false;
    raw.ziweiHour = shichenIndex(raw.clockHour, raw.clockMinute, raw.trueSolar ? (raw.longitude ?? 120) : 120);
    applyBundle(castBoth(raw));
  };

  const showResult = !!bundle && (!!bundle.ziwei || !!bundle.bazi);
  const activeError = bundle
    ? (school === 'ziwei' ? bundle.ziweiError : bundle.baziError)
    : formError;

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--tx-1)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 20px',
          borderBottom: '1px solid var(--bdr)',
          background: 'var(--bg-0)',
        }}
      >
        <Link href="/" style={{ color: 'var(--ac)', textDecoration: 'none', letterSpacing: '0.28em', fontSize: 13 }}>
          {SITE_NAME}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--tx-3)', fontSize: 12 }}>v{APP_VERSION}</span>
          {bundle && (
            <button
              type="button"
              onClick={() => { setBundle(null); setFormError(null); }}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                border: '1px solid var(--bdr-med)',
                borderRadius: 999,
                background: 'transparent',
                color: 'var(--tx-2)',
                fontSize: 12,
              }}
            >
              重新起盘
            </button>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? '切换亮色' : '切换暗色'}
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              border: '1px solid var(--ac-bdr)',
              borderRadius: 999,
              background: 'var(--ac-bg)',
              color: 'var(--ac)',
              fontSize: 12,
            }}
          >
            {theme === 'dark' ? '亮色' : '暗色'}
          </button>
        </div>
      </header>

      <section style={{ maxWidth: 1280, margin: '0 auto', padding: showResult ? '20px 16px 48px' : '32px 16px 64px' }}>
        <div className="school-switch" role="group" aria-label="选择盘种" data-testid="school-switch">
          <button type="button" className={school === 'ziwei' ? 'is-on' : undefined} aria-pressed={school === 'ziwei'} onClick={() => setSchool('ziwei')}>紫微斗数</button>
          <button type="button" className={school === 'bazi' ? 'is-on' : undefined} aria-pressed={school === 'bazi'} onClick={() => setSchool('bazi')}>八字</button>
        </div>

        <div className={showResult ? 'chart-result' : 'chart-result chart-result-empty'}>
          <div>
            {!showResult ? (
              <>
                <p style={{ fontSize: 12, letterSpacing: '0.35em', color: 'var(--ac)', marginBottom: 8 }}>
                  {school === 'bazi' ? '八字' : '紫微斗数'}
                </p>
                <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: 'var(--tx-0)' }}>起盘</h1>
                <p style={{ color: 'var(--tx-2)', marginBottom: 16, fontSize: 14, lineHeight: 1.7 }}>
                  出生资料只填一次。排好以后可以在紫微斗数和八字之间切换，资料不会丢掉。
                </p>
                <Settings
                  calendar={calendar}
                  leapMonth={leapMonth}
                  trueSolar={trueSolar}
                  sect={sect}
                  onCalendar={(value) => { setCalendar(value); if (value !== 'lunar') setLeapMonth(false); }}
                  onLeap={setLeapMonth}
                  onTrueSolar={setTrueSolar}
                  onSect={setSect}
                />
                <BirthForm calendar={calendar} trueSolar={trueSolar} onSubmit={startChart} />
                {activeError && <p role="alert" style={{ color: 'var(--ji)', fontSize: 13, marginTop: 12 }}>{activeError}</p>}
                <p style={{ color: 'var(--tx-3)', fontSize: 12, marginTop: 28, lineHeight: 1.7 }}>
                  {UPSTREAM_NOTE}{' · '}
                  <a href={UPSTREAM_URL} style={{ color: 'var(--ac)' }}>{UPSTREAM_URL.replace('https://', '')}</a>
                  {' · 八字库 xuantian-bazi MIT'}
                </p>
              </>
            ) : school === 'bazi' && bundle?.bazi ? (
              <>
                <Settings
                  calendar={bundle.raw.calendar}
                  leapMonth={bundle.raw.leapMonth}
                  trueSolar={bundle.raw.trueSolar}
                  sect={bundle.raw.sect}
                  onCalendar={(value) => recastSettings({ calendar: value, leapMonth: value === 'lunar' ? bundle.raw.leapMonth : false })}
                  onLeap={(value) => recastSettings({ leapMonth: value })}
                  onTrueSolar={(value) => recastSettings({ trueSolar: value })}
                  onSect={(value) => recastSettings({ sect: value })}
                />
                <BaziBoard
                  chart={bundle.bazi}
                  decadeIndex={decadeIndex}
                  year={flowYear}
                  onDecadeChange={(index) => {
                    setDecadeIndex(index);
                    setFlowYear(defaultYear(bundle.bazi!, index));
                  }}
                  onYearChange={setFlowYear}
                />
              </>
            ) : school === 'ziwei' && bundle?.ziwei ? (
              <>
                <Settings
                  calendar={bundle.raw.calendar}
                  leapMonth={bundle.raw.leapMonth}
                  trueSolar={bundle.raw.trueSolar}
                  sect={bundle.raw.sect}
                  onCalendar={(value) => recastSettings({ calendar: value, leapMonth: value === 'lunar' ? bundle.raw.leapMonth : false })}
                  onLeap={(value) => recastSettings({ leapMonth: value })}
                  onTrueSolar={(value) => recastSettings({ trueSolar: value })}
                  onSect={(value) => recastSettings({ sect: value })}
                />
                <ChartBoard
                  chart={bundle.ziwei}
                  onPalaceSelect={setSelectedPalace}
                  timeView={timeView}
                  liunianYear={liunianYear}
                  onTimeViewChange={setTimeView}
                  onLiunianYearChange={setLiunianYear}
                />
              </>
            ) : null}
            {showResult && activeError && (
              <p role="alert" style={{ color: 'var(--ji)', fontSize: 13, marginTop: 12 }}>{activeError}</p>
            )}
          </div>
          <InsightPanel
            chart={bundle?.ziwei}
            selectedPalace={selectedPalace}
            timeView={timeView}
            liunianYear={liunianYear}
            school={school}
            baziContext={school === 'bazi' ? baziContext : null}
            conversationKey={conversationKey}
          />
        </div>
      </section>
    </main>
  );
}

function Settings({
  calendar, leapMonth, trueSolar, sect, onCalendar, onLeap, onTrueSolar, onSect,
}: {
  calendar: BaziCalendar;
  leapMonth: boolean;
  trueSolar: boolean;
  sect: BaziSect;
  onCalendar: (value: BaziCalendar) => void;
  onLeap: (value: boolean) => void;
  onTrueSolar: (value: boolean) => void;
  onSect: (value: BaziSect) => void;
}) {
  return (
    <div className="bazi-settings" data-testid="chart-settings">
      <div role="group" aria-label="历法">
        <button type="button" className={calendar === 'solar' ? 'is-on' : undefined} aria-pressed={calendar === 'solar'} onClick={() => onCalendar('solar')}>公历</button>
        <button type="button" className={calendar === 'lunar' ? 'is-on' : undefined} aria-pressed={calendar === 'lunar'} onClick={() => onCalendar('lunar')}>农历</button>
      </div>
      {calendar === 'lunar' && (
        <label>
          <input type="checkbox" checked={leapMonth} onChange={event => onLeap(event.target.checked)} />
          闰月
        </label>
      )}
      <label>
        <input data-testid="true-solar-toggle" type="checkbox" checked={trueSolar} onChange={event => onTrueSolar(event.target.checked)} />
        真太阳时
      </label>
      <div role="group" aria-label="子时换日">
        <button type="button" className={sect === 2 ? 'is-on' : undefined} aria-pressed={sect === 2} onClick={() => onSect(2)}>晚子时算当天</button>
        <button type="button" className={sect === 1 ? 'is-on' : undefined} aria-pressed={sect === 1} onClick={() => onSect(1)}>23点起算次日</button>
      </div>
      <p>子时换日只改八字的日柱。紫微仍用原来的早晚子时。真太阳时打开时，八字交给 xuantian-bazi 修正一次，紫微只用原来的经度差。</p>
    </div>
  );
}
