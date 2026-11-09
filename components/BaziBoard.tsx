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
        年柱、月柱按节气交换。输入按北京时间 Asia/Shanghai。子时：{chart.sectLabel}。
        {chart.trueSolar
          ? ` 真太阳时由八字库计算一次${chart.assumedMeridian120 ? '，未选出生地时经度按东经 120°' : ''}。${chart.dstApplied ? `这次夏令时修正 ${chart.dstMinutes ?? 0} 分钟。` : '这次没有夏令时修正。'}排盘时刻 ${chart.chartDatetime}。`
          : ' 真太阳时已关闭，直接用钟面时间，不再做经度或夏令时修正。'}
        紫微时辰仍只用本站原来的经度差，两套校正不会叠在同一次计算上。
      </p>

      <div className="bazi-pillars">
        {chart.pillars.map(pillar => (
          <article key={pillar.type} data-testid={`bazi-pillar-${pillar.type}`}>
            <h3>{pillar.label}</h3>
            <p className="bazi-ganzhi">{pillar.ganZhi}</p>
            <p>天干 {pillar.tianGan} · 地支 {pillar.diZhi}</p>
            {pillar.mainStar && <p>十神 {pillar.mainStar}</p>}
            {pillar.wuXing && <p>五行 {pillar.wuXing}</p>}
            {pillar.naYin && <p>纳音 {pillar.naYin}</p>}
            {pillar.cangGanDetail.length > 0 && (
              <p>藏干 {pillar.cangGanDetail.map(item => `${item.gan}${item.shiShen ? ` ${item.shiShen}` : ''}${item.wuXing ? ` ${item.wuXing}` : ''}`).join('、')}</p>
            )}
            {pillar.shenSha.length > 0 && <p>神煞 {pillar.shenSha.join('、')}</p>}
          </article>
        ))}
      </div>

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
        八字计算使用 xuantian-bazi {chart.engineVersion}（MIT，github.com/sfwal/xuantian-bazi）。界面是命宫图。神煞只列出库返回的名称，不作吉凶承诺。
      </p>
    </section>
  );
}
