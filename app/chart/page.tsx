'use client';
import { useState } from 'react';
import Link from 'next/link';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel from '@/components/InsightPanel';
import { useTheme } from '@/components/ThemeProvider';
import type { TimeView } from '@/components/TimeNav';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart, Palace } from '@/lib/ziwei/types';
import { SITE_NAME, UPSTREAM_NOTE, UPSTREAM_URL } from '@/lib/site';

/**
 * 命盘页。表单交给本仓库的 generateChart()，命盘方格里的时间轴切换本命 / 大限 / 流年。
 * 宫格布局与点击交互留在 ChartBoard，这里只换页面外壳。
 */
export default function ChartPage() {
  const { theme, toggle } = useTheme();
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeView, setTimeView] = useState<TimeView>('mingpan');
  const [liunianYear, setLiunianYear] = useState(() => new Date().getFullYear());

  const resetReading = () => {
    setSelectedPalace(null);
    setTimeView('mingpan');
    setLiunianYear(new Date().getFullYear());
  };

  const startChart = (info: BirthInfo) => {
    try {
      setChart(generateChart(info));
      resetReading();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '起盘失败，请检查出生日期。');
    }
  };

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
          {chart && (
            <button
              type="button"
              onClick={() => { setChart(null); resetReading(); }}
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

      <section style={{ maxWidth: 1280, margin: '0 auto', padding: chart ? '20px 16px 48px' : '32px 16px 64px' }}>
        <div className={chart ? 'chart-result' : 'chart-result chart-result-empty'}>
          <div>
            {!chart ? (
              <>
                <p style={{ fontSize: 12, letterSpacing: '0.35em', color: 'var(--ac)', marginBottom: 8 }}>
                  紫微斗数
                </p>
                <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: 'var(--tx-0)' }}>起盘</h1>
                <p style={{ color: 'var(--tx-2)', marginBottom: 28, fontSize: 14, lineHeight: 1.7 }}>
                  填写出生年月日时。命盘在这台浏览器里算出来，接着可以看本命、大限和流年。右侧上面是固定说明，起盘后可以在下面继续追问。
                </p>
                <BirthForm onSubmit={startChart} />
                {error && (
                  <p role="alert" style={{ color: 'var(--ji)', fontSize: 13, marginTop: 12 }}>{error}</p>
                )}
                <p style={{ color: 'var(--tx-3)', fontSize: 12, marginTop: 28, lineHeight: 1.7 }}>
                  {UPSTREAM_NOTE}{' · '}
                  <a href={UPSTREAM_URL} style={{ color: 'var(--ac)' }}>{UPSTREAM_URL.replace('https://', '')}</a>
                </p>
              </>
            ) : (
              <ChartBoard
                chart={chart}
                onPalaceSelect={setSelectedPalace}
                timeView={timeView}
                liunianYear={liunianYear}
                onTimeViewChange={setTimeView}
                onLiunianYearChange={setLiunianYear}
              />
            )}
          </div>
          <InsightPanel
            chart={chart}
            selectedPalace={selectedPalace}
            timeView={timeView}
            liunianYear={liunianYear}
          />
        </div>
      </section>
    </main>
  );
}
