'use client';

import { decadeTextOf } from '@/lib/bazi/ai-context';
import type { BaziChartView } from '@/lib/bazi/types';

interface BaziBoardProps {
  chart: BaziChartView;
  decadeIndex: number;
  year: number | null;
  onDecadeChange: (index: number) => void;
  onYearChange: (year: number) => void;
}

export default function BaziBoard({ chart, decadeIndex, year, onDecadeChange, onYearChange }: BaziBoardProps) {
  const decade = chart.decades[decadeIndex];
  const selectedYear = decade?.years.find(item => item.year === year);
  const target = `八字盘 · ${decade ? decadeTextOf(decade) : '大运未返回'} · 流年 ${selectedYear ? `${selectedYear.year} ${selectedYear.ganZhi}` : '未选择'}`;

  return (
    <section className="bazi-board" aria-label="八字盘" data-testid="bazi-board">
      <p className="bazi-kicker">八字</p>
      <h2>四柱</h2>
      <p className="bazi-target" data-testid="bazi-reading-target">{target}</p>
      <p className="bazi-caliber" data-testid="bazi-caliber">
        钟面 {chart.birthDate} {chart.birthTime}。{chart.timeBasisLabel}。排盘时刻 {chart.chartDatetime}。
        年柱、月柱按节气交换。子时：{chart.sectLabel}。
        {chart.trueSolar
          ? ` 真太阳时计算一次${chart.assumedMeridian120 ? '，未选出生地时经度按东经 120°' : ''}。`
          : ' 真太阳时已关闭。'}
        {chart.timeBasis === 'wall'
          ? (chart.dstApplied ? ` 原始钟面的历史夏令时已扣 ${Math.abs(chart.dstMinutes ?? 0)} 分钟。` : ' 这一天没有可扣的历史夏令时。')
          : ' 标准北京时间不再扣历史夏令时。'}
        紫微仍用原来的经度差，夏令时不自动扣，也不跟随这个时间依据。
      </p>

      <PillarSheet pillars={chart.pillars} />

      <p className="bazi-meta" data-testid="bazi-day-master">
        日主 {chart.dayMaster}{chart.dayMasterElement}
        {chart.zodiac ? ` · 生肖 ${chart.zodiac}` : ''}
        {chart.startYun ? ` · ${chart.startYun}` : ''}
      </p>
      {chart.fiveElements.length > 0 && (
        <p className="bazi-meta" data-testid="bazi-five">
          五行 {chart.fiveElements.map(item => item.score === null ? item.element : `${item.element} ${item.score}`).join(' · ')}
        </p>
      )}
      {chart.lunarDatetime && <p className="bazi-meta">农历 {chart.lunarDatetime}</p>}

      <div className="bazi-cycle-block">
        <h3>大运</h3>
        <div className="bazi-cycles" role="group" aria-label="大运">
          {chart.decades.map((item, index) => (
            <button
              key={`${item.label}-${item.startYear ?? index}`}
              type="button"
              className={index === decadeIndex ? 'is-on' : undefined}
              aria-pressed={index === decadeIndex}
              onClick={() => onDecadeChange(index)}
            >
              {decadeTextOf(item)}
            </button>
          ))}
        </div>
      </div>

      <div className="bazi-cycle-block">
        <h3>流年</h3>
        {decade && decade.years.length > 0 ? (
          <div className="bazi-cycles" role="group" aria-label="流年">
            {decade.years.map(item => (
              <button
                key={item.year}
                type="button"
                className={item.year === year ? 'is-on' : undefined}
                aria-pressed={item.year === year}
                onClick={() => onYearChange(item.year)}
              >
                {item.year} {item.ganZhi}
              </button>
            ))}
          </div>
        ) : (
          <p className="bazi-meta">这一段大运库没有列出流年。</p>
        )}
      </div>

      <p className="bazi-credit">
        八字计算使用 xuantian-bazi {chart.engineVersion}（MIT，github.com/sfwal/xuantian-bazi）。界面是命宫图。表内只列库已经返回的干支、十神、藏干、纳音、五行和神煞。神煞只列出名称，不作吉凶承诺。
      </p>
    </section>
  );
}

function PillarSheet({ pillars }: { pillars: BaziChartView['pillars'] }) {
  const slots = Math.max(0, ...pillars.map(pillar => Math.max(pillar.cangGanDetail.length, pillar.cangGan.length)));
  const showNaYin = pillars.some(pillar => pillar.naYin);
  const showWuXing = pillars.some(pillar => pillar.wuXing);
  const showShenSha = pillars.some(pillar => pillar.shenSha.length > 0);
  return (
    <div className="bazi-sheet" role="table" aria-label="四柱" data-testid="bazi-sheet">
      <div role="columnheader" className="bazi-cell is-label" />
      {pillars.map(pillar => (
        <div key={pillar.type} role="columnheader" className="bazi-cell is-head" data-testid={`bazi-pillar-${pillar.type}`}>
          {pillar.label}
        </div>
      ))}
      <div role="rowheader" className="bazi-cell is-label">天干</div>
      {pillars.map(pillar => (
        <div key={`${pillar.type}-gan`} role="cell" className="bazi-cell bazi-stem">{pillar.tianGan}</div>
      ))}
      <div role="rowheader" className="bazi-cell is-label">十神</div>
      {pillars.map(pillar => (
        <div key={`${pillar.type}-star`} role="cell" className="bazi-cell">{pillar.mainStar}</div>
      ))}
      <div role="rowheader" className="bazi-cell is-label">地支</div>
      {pillars.map(pillar => (
        <div key={`${pillar.type}-zhi`} role="cell" className="bazi-cell bazi-branch">{pillar.diZhi}</div>
      ))}
      {Array.from({ length: slots }, (_, index) => (
        <HiddenRows key={index} pillars={pillars} index={index} labeled={index === 0} />
      ))}
      {showNaYin && (
        <>
          <div role="rowheader" className="bazi-cell is-label">纳音</div>
          {pillars.map(pillar => (
            <div key={`${pillar.type}-nayin`} role="cell" className="bazi-cell is-wrap">{pillar.naYin}</div>
          ))}
        </>
      )}
      {showWuXing && (
        <>
          <div role="rowheader" className="bazi-cell is-label">五行</div>
          {pillars.map(pillar => (
            <div key={`${pillar.type}-wx`} role="cell" className="bazi-cell is-wrap">{pillar.wuXing}</div>
          ))}
        </>
      )}
      {showShenSha && (
        <>
          <div role="rowheader" className="bazi-cell is-label">神煞</div>
          {pillars.map(pillar => (
            <div key={`${pillar.type}-sha`} role="cell" className="bazi-cell is-wrap">{pillar.shenSha.join('、')}</div>
          ))}
        </>
      )}
    </div>
  );
}

function HiddenRows({ pillars, index, labeled }: { pillars: BaziChartView['pillars']; index: number; labeled: boolean }) {
  return (
    <>
      <div role="rowheader" className="bazi-cell is-label">{labeled ? '藏干' : ''}</div>
      {pillars.map(pillar => {
        const hidden = hiddenAt(pillar, index);
        return (
          <div key={`${pillar.type}-cang-${index}`} role="cell" className="bazi-cell bazi-hidden">{hidden?.gan ?? ''}</div>
        );
      })}
      <div role="rowheader" className="bazi-cell is-label">{labeled ? '十神' : ''}</div>
      {pillars.map(pillar => {
        const hidden = hiddenAt(pillar, index);
        return (
          <div key={`${pillar.type}-shi-${index}`} role="cell" className="bazi-cell">{hidden?.shiShen ?? ''}</div>
        );
      })}
    </>
  );
}

function hiddenAt(pillar: BaziChartView['pillars'][number], index: number): { gan: string; shiShen: string } | null {
  const detail = pillar.cangGanDetail[index];
  if (detail) return { gan: detail.gan, shiShen: detail.shiShen };
  const gan = pillar.cangGan[index];
  return gan ? { gan, shiShen: '' } : null;
}
