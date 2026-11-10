'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AstroBoard from '@/components/AstroBoard';
import AstroPlaceFields from '@/components/AstroPlaceFields';
import BirthForm from '@/components/BirthForm';
import BaziBoard from '@/components/BaziBoard';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel from '@/components/InsightPanel';
import { useTheme } from '@/components/ThemeProvider';
import type { TimeView } from '@/components/TimeNav';
import { buildAstroAiContext } from '@/lib/astro/ai-context';
import { ASTRO_ERRORS } from '@/lib/astro/errors';
import { astroGapKey, DEFAULT_ASTRO_PLACE, presetForBirthCity, readCoords, resolvedZone } from '@/lib/astro/place';
import { requestAstroChart } from '@/lib/astro/request';
import type { AstroChartView, AstroDstChoice, AstroPlaceState, AstroPrompt } from '@/lib/astro/types';
import { buildBaziAiContext } from '@/lib/bazi/ai-context';
import { castBazi } from '@/lib/bazi/cast';
import type { BaziCalendar, BaziChartView, BaziSect, BaziTimeBasis } from '@/lib/bazi/types';
import { APP_VERSION, SITE_NAME, UPSTREAM_NOTE, UPSTREAM_URL } from '@/lib/site';
import { generateChart } from '@/lib/ziwei/algorithm';
import { lunarToSolar } from '@/lib/ziwei/lunar-solar';
import { shichenIndex } from '@/lib/ziwei/shichen';
import type { BirthInfo, Palace, ZiweiChart } from '@/lib/ziwei/types';

type School = 'ziwei' | 'bazi' | 'astro';

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
  timeUnknown: boolean;
  astro: AstroPlaceState;
  timeBasis: BaziTimeBasis | null;
}

interface CastBundle {
  raw: RawBirth;
  ziwei: ZiweiChart | null;
  ziweiError: string | null;
  bazi: BaziChartView | null;
  baziError: string | null;
  astro: AstroChartView | null;
  astroError: string | null;
  astroPrompt: AstroPrompt | null;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function castLocal(raw: RawBirth): Pick<CastBundle, 'ziwei' | 'ziweiError' | 'bazi' | 'baziError'> {
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
      timeBasis: raw.timeBasis ?? undefined,
    });
  } catch (error) {
    baziError = error instanceof Error ? error.message : '八字起盘失败，请检查出生日期。';
  }

  return { ziwei, ziweiError, bazi, baziError };
}

export default function ChartWorkspace({ initialSchool = 'ziwei' }: { initialSchool?: School }) {
  const { theme, toggle } = useTheme();
  const [school, setSchool] = useState<School>(initialSchool);
  const [mobilePane, setMobilePane] = useState<'chart' | 'insight'>('chart');
  const [calendar, setCalendar] = useState<BaziCalendar>('solar');
  const [leapMonth, setLeapMonth] = useState(false);
  const [trueSolar, setTrueSolar] = useState(false);
  const [sect, setSect] = useState<BaziSect>(2);
  const [astroPlace, setAstroPlace] = useState<AstroPlaceState>(DEFAULT_ASTRO_PLACE);
  const [bundle, setBundle] = useState<CastBundle | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [casting, setCasting] = useState(false);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [timeView, setTimeView] = useState<TimeView>('mingpan');
  const [liunianYear, setLiunianYear] = useState(() => new Date().getFullYear());
  const [decadeIndex, setDecadeIndex] = useState(-1);
  const [astroTransitOpen, setAstroTransitOpen] = useState(false);
  const [homeTick, setHomeTick] = useState(0);
  const [flowYear, setFlowYear] = useState<number | null>(null);
  const [dstInClock, setDstInClock] = useState(false);
  const dstRef = useRef(false);
  const timeUnknownRef = useRef(false);
  const placeTouchedRef = useRef(false);
  const placeRef = useRef(astroPlace);
  const castSeq = useRef(0);
  placeRef.current = astroPlace;

  const baziContext = useMemo(
    () => (bundle?.bazi ? buildBaziAiContext(bundle.bazi, decadeIndex, flowYear) : null),
    [bundle, decadeIndex, flowYear],
  );
  const astroContext = useMemo(
    () => (bundle?.astro ? buildAstroAiContext(bundle.astro, astroTransitOpen) : null),
    [bundle, astroTransitOpen],
  );
  useEffect(() => {
    if (homeTick === 0) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [homeTick]);

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
      bundle.astro?.utcText ?? '',
      bundle.astro?.zone ?? '',
      bundle.astro?.houseSystem ?? '',
      bundle.astro?.latitude ?? '',
      bundle.astro?.longitude ?? '',
      bundle.astro?.timeStatus ?? '',
      bundle.raw.timeBasis ?? '',
      timeView,
      decadeIndex,
      flowYear ?? '',
      astroTransitOpen ? 1 : 0,
    ].join('|')
    : `${school}|empty`;

  const applyBundle = (next: CastBundle, resetNav: boolean) => {
    setBundle(next);
    if (!resetNav) return;
    setSelectedPalace(null);
    setTimeView('mingpan');
    setDecadeIndex(-1);
    setFlowYear(null);
    setAstroTransitOpen(false);
    setHomeTick(tick => tick + 1);
  };

  const editPlace = (patch: Partial<AstroPlaceState>) => {
    if ('latitude' in patch || 'longitude' in patch || 'zoneChoice' in patch || 'customZone' in patch) {
      placeTouchedRef.current = true;
    }
    const next = { ...placeRef.current, ...patch };
    const clearsTime = 'latitude' in patch || 'longitude' in patch || 'zoneChoice' in patch || 'customZone' in patch;
    if (clearsTime) {
      if (!('dstChoice' in patch)) next.dstChoice = null;
      if (!('acceptGapKey' in patch)) next.acceptGapKey = null;
    }
    placeRef.current = next;
    setAstroPlace(next);
  };

  const publish = async (raw: RawBirth, mode: 'form' | 'settings' | 'astro') => {
    const seq = ++castSeq.current;
    setCasting(true);
    const local = castLocal(raw);
    let astro: AstroChartView | null = null;
    let astroError: string | null = null;
    let astroPrompt: AstroPrompt | null = null;
    const coords = readCoords(raw.astro.latitude, raw.astro.longitude);
    if (raw.timeUnknown) {
      astroError = ASTRO_ERRORS.unknownTime;
    } else if (!coords) {
      astroError = ASTRO_ERRORS.needPlace;
    } else {
      try {
        const zone = resolvedZone(raw.astro);
        const key = astroGapKey({
          calendar: raw.calendar,
          leapMonth: raw.leapMonth,
          year: raw.year,
          month: raw.month,
          day: raw.day,
          hour: raw.clockHour,
          minute: raw.clockMinute,
          zone,
          latitude: raw.astro.latitude,
          longitude: raw.astro.longitude,
        });
        const result = await requestAstroChart({
          calendar: raw.calendar,
          year: raw.year,
          month: raw.month,
          day: raw.day,
          hour: raw.clockHour,
          minute: raw.clockMinute,
          leapMonth: raw.leapMonth,
          timeUnknown: false,
          latitude: coords.latitude,
          longitude: coords.longitude,
          zone,
          dstChoice: raw.astro.dstChoice,
          acceptGap: raw.astro.acceptGapKey !== null && raw.astro.acceptGapKey === key,
          houseSystem: raw.astro.houseSystem,
          transitUtc: null,
        });
        if (seq !== castSeq.current) return;
        if (result.ok) astro = result.chart;
        else {
          astroError = result.error;
          astroPrompt = result.prompt ?? null;
        }
      } catch {
        if (seq !== castSeq.current) return;
        astroError = ASTRO_ERRORS.network;
      }
    }
    if (seq !== castSeq.current) return;
    const next: CastBundle = { raw, ...local, astro, astroError, astroPrompt };
    if (mode === 'astro' && !astro && astroError === ASTRO_ERRORS.network) {
      setBundle(current => (current?.astro ? { ...current, astroError } : next));
      setCasting(false);
      return;
    }
    const any = Boolean(next.ziwei || next.bazi || next.astro || next.astroPrompt);
    if (mode === 'form' && !any) {
      setFormError(next.astroError || next.baziError || next.ziweiError || '起盘失败，请检查出生日期。');
      setCasting(false);
      return;
    }
    setFormError(null);
    applyBundle(next, mode !== 'astro');
    setCasting(false);
  };

  const commitPlace = () => {
    if (!bundle) return;
    void publish({ ...bundle.raw, astro: placeRef.current }, 'astro');
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
      timeUnknown: timeUnknownRef.current,
      astro: placeRef.current,
      timeBasis: dstRef.current ? 'wall' : 'standard',
    };
    void publish(raw, 'form');
  };

  const recastSettings = (patch: Partial<Pick<RawBirth, 'calendar' | 'leapMonth' | 'trueSolar' | 'sect'>>) => {
    if (!bundle) return;
    const raw = { ...bundle.raw, ...patch, astro: placeRef.current };
    if (raw.calendar !== 'lunar') raw.leapMonth = false;
    raw.ziweiHour = shichenIndex(raw.clockHour, raw.clockMinute, raw.trueSolar ? (raw.longitude ?? 120) : 120);
    if (patch.calendar !== undefined || patch.leapMonth !== undefined) {
      raw.timeBasis = null;
      raw.astro = { ...raw.astro, dstChoice: null, acceptGapKey: null };
      placeRef.current = raw.astro;
      setAstroPlace(raw.astro);
    }
    void publish(raw, 'settings');
  };

  const chooseDst = (choice: AstroDstChoice) => {
    editPlace({ dstChoice: choice });
    commitPlace();
  };

  const acceptGap = () => {
    if (!bundle) return;
    const place = placeRef.current;
    const key = astroGapKey({
      calendar: bundle.raw.calendar,
      leapMonth: bundle.raw.leapMonth,
      year: bundle.raw.year,
      month: bundle.raw.month,
      day: bundle.raw.day,
      hour: bundle.raw.clockHour,
      minute: bundle.raw.clockMinute,
      zone: resolvedZone(place),
      latitude: place.latitude,
      longitude: place.longitude,
    });
    editPlace({ acceptGapKey: key });
    commitPlace();
  };

  const showResult = !!bundle && (!!bundle.ziwei || !!bundle.bazi || !!bundle.astro || !!bundle.astroPrompt);
  const activeError = bundle
    ? (school === 'ziwei' ? bundle.ziweiError : school === 'bazi' ? bundle.baziError : bundle.astroError)
    : formError;
  const schoolLabel = school === 'bazi' ? '八字' : school === 'astro' ? '占星' : '紫微斗数';

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
          <Link href="/settings" data-testid="ai-settings-link" style={{ color: 'var(--ac)', fontSize: 12, textDecoration: 'none' }}>AI 设置</Link>
          {bundle && (
            <button
              type="button"
              onClick={() => {
                setAstroPlace(placeRef.current);
                setBundle(null);
                setFormError(null);
              }}
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

      <section className="workspace-shell" style={{ padding: showResult ? '20px 16px 48px' : '32px 16px 64px' }}>
        <div className="school-switch" role="group" aria-label="选择盘种" data-testid="school-switch">
          <button type="button" className={school === 'ziwei' ? 'is-on' : undefined} aria-pressed={school === 'ziwei'} onClick={() => setSchool('ziwei')}>紫微斗数</button>
          <button type="button" className={school === 'bazi' ? 'is-on' : undefined} aria-pressed={school === 'bazi'} onClick={() => setSchool('bazi')}>八字</button>
          <button type="button" data-testid="school-astro" className={school === 'astro' ? 'is-on' : undefined} aria-pressed={school === 'astro'} onClick={() => setSchool('astro')}>占星</button>
        </div>

        {showResult && (
          <div className="pane-switch" role="group" aria-label="排盘或解读">
            <button type="button" data-testid="pane-chart" aria-pressed={mobilePane === 'chart'} onClick={() => setMobilePane('chart')}>排盘</button>
            <button type="button" data-testid="pane-insight" aria-pressed={mobilePane === 'insight'} onClick={() => setMobilePane('insight')}>解读</button>
          </div>
        )}
        <div className={showResult ? 'chart-result' : 'chart-result chart-result-empty'} data-pane={mobilePane}>
          <div className="chart-main">
            {showResult && bundle && (
              <details className="fold-edit" data-testid="edit-birth">
                <summary>编辑出生资料</summary>
                <Settings
                  calendar={bundle.raw.calendar}
                  leapMonth={bundle.raw.leapMonth}
                  trueSolar={bundle.raw.trueSolar}
                  sect={bundle.raw.sect}
                  onCalendar={(value) => recastSettings({ calendar: value, leapMonth: value === 'lunar' ? bundle.raw.leapMonth : false })}
                  onLeap={(value) => recastSettings({ leapMonth: value })}
                  onTrueSolar={(value) => { setTrueSolar(value); recastSettings({ trueSolar: value }); }}
                  onSect={(value) => recastSettings({ sect: value })}
                />
                <BirthForm
                  calendar={bundle.raw.calendar}
                  trueSolar={bundle.raw.trueSolar}
                  clockLabel={school === 'astro' ? '所选时区的钟面时间' : undefined}
                  showDstClock={school === 'bazi'}
                  dstInClock={dstInClock}
                  onDstInClock={checked => {
                    dstRef.current = checked;
                    setDstInClock(checked);
                    void publish({ ...bundle.raw, timeBasis: checked ? 'wall' : 'standard' }, 'settings');
                  }}
                  initialData={{
                    name: bundle.raw.name ?? '',
                    year: String(bundle.raw.year),
                    month: String(bundle.raw.month),
                    day: String(bundle.raw.day),
                    clockHour: String(bundle.raw.clockHour),
                    clockMinute: String(bundle.raw.clockMinute),
                    unknownTime: bundle.raw.timeUnknown,
                    province: bundle.raw.province ?? '',
                    city: bundle.raw.city ?? '',
                    longitude: bundle.raw.longitude ?? 120,
                    gender: bundle.raw.gender,
                  }}
                  onFormSave={data => { timeUnknownRef.current = data.unknownTime; }}
                  onSubmit={startChart}
                />
              </details>
            )}
            {!showResult ? (
              <>
                <p style={{ fontSize: 12, letterSpacing: '0.35em', color: 'var(--ac)', marginBottom: 8 }}>
                  {schoolLabel}
                </p>
                <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: 'var(--tx-0)' }}>起盘</h1>
                <p style={{ color: 'var(--tx-2)', marginBottom: 16, fontSize: 14, lineHeight: 1.7 }}>
                  出生资料只填一次。排好以后可以在紫微斗数、八字和占星之间切换，资料不会丢掉。
                  {school === 'astro'
                    ? ' 占星把出生时间当作所选时区的钟面。勾选时辰不详时，占星不排上升。'
                    : ' 占星另外使用纬度、经度和时区，并把出生时间当作该时区的钟面。'}
                </p>
                <details className="fold-edit">
                  <summary>历法与真太阳时</summary>
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
                </details>
                {school === 'astro' && (
                  <AstroPlaceFields place={astroPlace} disabled={casting} onChange={editPlace} />
                )}
                <BirthForm
                  calendar={calendar}
                  trueSolar={trueSolar}
                  clockLabel={school === 'astro' ? '所选时区的钟面时间' : undefined}
                  showDstClock={school === 'bazi'}
                  dstInClock={dstInClock}
                  onDstInClock={checked => { dstRef.current = checked; setDstInClock(checked); }}
                  loading={casting}
                  onFormSave={data => {
                    timeUnknownRef.current = data.unknownTime;
                    if (placeTouchedRef.current) return;
                    const preset = presetForBirthCity(data.city);
                    if (!preset) return;
                    const next = {
                      ...placeRef.current,
                      latitude: String(preset.latitude),
                      longitude: String(preset.longitude),
                      zoneChoice: preset.zone,
                      dstChoice: null,
                      acceptGapKey: null,
                    };
                    placeRef.current = next;
                    setAstroPlace(next);
                  }}
                  onSubmit={startChart}
                />
                {activeError && <p role="alert" style={{ color: 'var(--ji)', fontSize: 13, marginTop: 12 }}>{activeError}</p>}
                <p style={{ color: 'var(--tx-3)', fontSize: 12, marginTop: 28, lineHeight: 1.7 }}>
                  {UPSTREAM_NOTE}{' · '}
                  <a href={UPSTREAM_URL} style={{ color: 'var(--ac)' }}>{UPSTREAM_URL.replace('https://', '')}</a>
                  {' · 八字库 xuantian-bazi MIT · 星盘库 caelus MIT'}
                </p>
              </>
            ) : school === 'bazi' && bundle?.bazi ? (
              <>
                <BaziBoard
                  chart={bundle.bazi}
                  decadeIndex={decadeIndex}
                  year={flowYear}
                  onDecadeChange={(index) => {
                    setDecadeIndex(index);
                    setFlowYear(null);
                  }}
                  onYearChange={setFlowYear}
                  onBackNatal={() => { setDecadeIndex(-1); setFlowYear(null); }}
                />
              </>
            ) : school === 'ziwei' && bundle?.ziwei ? (
              <>
                <ChartBoard
                  chart={bundle.ziwei}
                  onPalaceSelect={setSelectedPalace}
                  timeView={timeView}
                  liunianYear={liunianYear}
                  onTimeViewChange={setTimeView}
                  onLiunianYearChange={setLiunianYear}
                />
              </>
            ) : school === 'astro' && bundle ? (
              <>
              <AstroBoard
                chart={bundle.astro}
                error={bundle.astroError}
                prompt={bundle.astroPrompt}
                place={astroPlace}
                casting={casting}
                onChange={editPlace}
                onCommit={commitPlace}
                onChooseDst={chooseDst}
                onAcceptGap={acceptGap}
                onRefreshTransit={commitPlace}
                onTransitOpen={setAstroTransitOpen}
              />
              </>
            ) : null}
            {showResult && school !== 'astro' && bundle?.astro && !['Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Macau'].includes(bundle.astro.zone) && (
              <p className="astro-note" data-testid="clock-meaning">
                占星按 {bundle.astro.zone}（{bundle.astro.offsetLabel}）理解这组钟面数字。八字和紫微仍把同一组数字当作北京时间。
              </p>
            )}
            {showResult && activeError && school !== 'astro' && (
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
            astroContext={school === 'astro' ? astroContext : null}
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
      <p>子时换日只改八字的日柱。紫微仍用原来的早晚子时，夏令时不自动扣。真太阳时打开时，八字按所选时间依据校正一次，紫微只用原来的经度差。占星不使用这个开关。</p>
    </div>
  );
}
