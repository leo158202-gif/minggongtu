'use client';

import { decadeTextOf } from '@/lib/bazi/ai-context';
import type { BaziChartView } from '@/lib/bazi/types';

interface BaziBoardProps {
  chart: BaziChartView;
  decadeIndex: number;
  year: number | null;
  onDecadeChange: (index: number) => void;
  onYearChange: (year: number) => void;
  onBackNatal: () => void;
}

export default function BaziBoard({ chart, decadeIndex, year, onDecadeChange, onYearChange, onBackNatal }: BaziBoardProps) {
  const decade = decadeIndex >= 0 ? chart.decades[decadeIndex] : undefined;
  const selectedYear = decade?.years.find(item => item.year === year);
  const target = decade
    ? `八字盘 · ${decadeTextOf(decade)} · 流年 ${selectedYear ? `${selectedYear.year} ${selectedYear.ganZhi}` : '未选择'}`
    : '八字本命';

  return (
    <section className="bazi-board" aria-label="八字盘" data-testid="bazi-board">
      <p className="bazi-kicker">八字</p>
      <h2>四柱</h2>
      <p className="bazi-target" data-testid="bazi-reading-target">{target}</p>
      <p className="bazi-caliber" data-testid="bazi-caliber">
        钟面 {chart.birthDate} {chart.birthTime} · {chart.timeBasisLabel} · 排盘时刻 {chart.chartDatetime}
        {chart.timeBasis === 'wall' && !chart.dstApplied ? ' · 这一天没有可扣的夏令时' : ''}
      </p>
      <details className="fold-edit">
        <summary>校时说明</summary>
        <p className="bazi-meta">
          年柱、月柱按节气交换。子时：{chart.sectLabel}。
          {chart.trueSolar
            ? `真太阳时计算一次${chart.assumedMeridian120 ? '，未选出生地时经度按东经 120°' : ''}。`
            : '真太阳时已关闭。'}
          {chart.timeBasis === 'wall'
            ? (chart.dstApplied ? `原始钟面的历史夏令时已扣 ${Math.abs(chart.dstMinutes ?? 0)} 分钟。` : '这一天没有可扣的历史夏令时。')
            : '标准北京时间不再扣历史夏令时。'}
          紫微仍用原来的经度差，夏令时不自动扣，也不跟随这个时间依据。
        </p>
      </details>

      <PillarSheet pillars={chart.pillars} />
      <JudgementCards chart={chart} />

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

      <details className="fold-edit" data-testid="bazi-fortune">
        <summary>大运与流年</summary>
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
            <p className="bazi-meta">先选一步大运，再看这一步里的流年。</p>
          )}
        </div>
        {decadeIndex >= 0 && (
          <button type="button" data-testid="bazi-back-natal" onClick={onBackNatal}>返回本命</button>
        )}
      </details>

      <p className="bazi-credit">
        八字计算使用 xuantian-bazi {chart.engineVersion}（MIT，github.com/sfwal/xuantian-bazi）。界面是命宫图。表内只列库已经返回的干支、十神、藏干、纳音、五行和神煞。神煞只列出名称，不作吉凶承诺。
      </p>
    </section>
  );
}

function JudgementCards({ chart }: { chart: BaziChartView }) {
  const item = chart.judgement;
  const known = item.status === 'known' && item.label;
  return (
    <div className="bazi-judge" data-testid="bazi-judge">
      <article className="bazi-judge-card" data-testid="bazi-strength">
        <h3>身强身弱</h3>
        <p className="bazi-judge-kicker">日主强弱 · 扶抑法参考</p>
        {known ? (
          <>
            <p className="bazi-judge-result">{item.dayMaster} 日 · {item.label}</p>
            {item.bar && (
              <div className="bazi-balance" data-testid="bazi-balance">
                <div className="bazi-balance-track" aria-hidden="true">
                  <span className="is-support" style={{ width: `${item.bar.supportPct}%` }} />
                  <span className="is-oppose" style={{ width: `${item.bar.opposePct}%` }} />
                </div>
                <p>助身 {item.bar.support}（{item.bar.supportPct}%） · 耗身 {item.bar.oppose}（{item.bar.opposePct}%）</p>
              </div>
            )}
            <ul>
              {item.season && <li>月令 {item.season}</li>}
              {item.root && <li>通根 {item.root}</li>}
              {item.support && <li>天干生扶 {item.support}</li>}
            </ul>
          </>
        ) : (
          <p data-testid="bazi-strength-unknown">这次没有可核验的身强身弱，未判定。</p>
        )}
        <details>
          <summary>判据</summary>
          <p>
            来自 xuantian-bazi {chart.engineVersion}（MIT）。强弱标题用库给出的标签。
            助身是印与比劫，耗身是食伤、财、官杀，权重是库返回的五行分值。分值和对不上库的标签时不画条。
            这是扶抑，不是调候，也不是格局取用。从格和专旺没有单独识别，接近特殊格局时待复核，不是确定结论。
            传统命理规则，仅供参考。
          </p>
          {item.seasonNote && <p>{item.seasonNote}</p>}
          {item.rootNote && <p>{item.rootNote}</p>}
          {item.supportNote && <p>{item.supportNote}</p>}
        </details>
      </article>
      <article className="bazi-judge-card" data-testid="bazi-useful">
        <h3>喜用神</h3>
        <p className="bazi-judge-kicker">扶抑法参考 · 不是调候或格局综合用神</p>
        {item.useful.length > 0 ? (
          <p className="bazi-judge-result" data-testid="bazi-useful-list">喜用 {item.useful.join('、')}</p>
        ) : (
          <p data-testid="bazi-useful-unknown">这次没有可核验的喜用五行，未判定。</p>
        )}
        {item.unfavorable.length > 0 && <p>扶抑里相对的一方 {item.unfavorable.join('、')}</p>}
        {item.usefulNote && <p>{item.usefulNote}</p>}
        {item.pattern && <p>库另给格局名「{item.pattern}」。这次喜用不由格局推出。{item.special ? '这个名字接近特殊格局，喜用待复核。' : ''}</p>}
        <p>传统命理规则，仅供参考。这里不保证趋吉避凶。</p>
      </article>
    </div>
  );
}

function elementOf(char: string): string {
  if ('甲乙寅卯'.includes(char)) return '木';
  if ('丙丁巳午'.includes(char)) return '火';
  if ('戊己辰戌丑未'.includes(char)) return '土';
  if ('庚辛申酉'.includes(char)) return '金';
  if ('壬癸亥子'.includes(char)) return '水';
  return '';
}

function knownElement(value: string): string {
  const char = value.trim().slice(0, 1);
  return '金木水火土'.includes(char) ? char : '';
}

interface HiddenItem {
  gan: string;
  element: string;
  shiShen: string;
}

function hiddenItems(pillar: BaziChartView['pillars'][number]): HiddenItem[] {
  if (pillar.cangGanDetail.length > 0) {
    return pillar.cangGanDetail.map(item => ({
      gan: item.gan,
      element: knownElement(item.wuXing) || elementOf(item.gan),
      shiShen: item.shiShen,
    }));
  }
  return pillar.cangGan.map(gan => ({ gan, element: elementOf(gan), shiShen: '' }));
}

function PillarSheet({ pillars }: { pillars: BaziChartView['pillars'] }) {
  const showNaYin = pillars.some(pillar => pillar.naYin);
  const showShenSha = pillars.some(pillar => pillar.shenSha.length > 0);
  const showHidden = pillars.some(pillar => hiddenItems(pillar).length > 0);
  return (
    <div className="bazi-sheet" role="table" aria-label="四柱" data-testid="bazi-sheet">
      <div role="columnheader" className="bazi-cell is-label band-main" />
      {pillars.map(pillar => (
        <div key={pillar.type} role="columnheader" className="bazi-cell is-head band-main" data-testid={`bazi-pillar-${pillar.type}`}>
          {pillar.label}
        </div>
      ))}
      <div role="rowheader" className="bazi-cell is-label band-main">干神</div>
      {pillars.map(pillar => (
        <div key={`${pillar.type}-star`} role="cell" className="bazi-cell bazi-minor band-main">{pillar.mainStar}</div>
      ))}
      <div role="rowheader" className="bazi-cell is-label band-main">天干</div>
      {pillars.map(pillar => (
        <div key={`${pillar.type}-gan`} role="cell" className={`bazi-cell bazi-stem band-main wx-${elementOf(pillar.tianGan)}`}>{pillar.tianGan}</div>
      ))}
      <div role="rowheader" className="bazi-cell is-label band-main">地支</div>
      {pillars.map(pillar => (
        <div key={`${pillar.type}-zhi`} role="cell" className={`bazi-cell bazi-branch band-main wx-${elementOf(pillar.diZhi)}`}>{pillar.diZhi}</div>
      ))}
      {showHidden && (
        <>
          <div role="rowheader" className="bazi-cell is-label band-hidden">藏干</div>
          {pillars.map(pillar => (
            <div key={`${pillar.type}-cang`} role="cell" className="bazi-cell is-stack band-hidden" data-testid={`bazi-hidden-${pillar.type}`}>
              <div className="bazi-stack">
                {hiddenItems(pillar).map((item, index) => (
                  <span key={`${item.gan}-${index}`} className={item.element ? `wx-${item.element}` : undefined}>
                    {item.element ? `${item.gan}·${item.element}` : item.gan}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div role="rowheader" className="bazi-cell is-label band-star">支神</div>
          {pillars.map(pillar => (
            <div key={`${pillar.type}-shi`} role="cell" className="bazi-cell is-stack band-star" data-testid={`bazi-shishen-${pillar.type}`}>
              <div className="bazi-stack">
                {hiddenItems(pillar).map((item, index) => (
                  <span key={`${item.shiShen}-${index}`} className={item.element ? `wx-${item.element}` : undefined}>{item.shiShen}</span>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
      {showNaYin && (
        <>
          <div role="rowheader" className="bazi-cell is-label band-nayin">纳音</div>
          {pillars.map(pillar => {
            const element = knownElement(pillar.naYin.slice(-1));
            return (
              <div key={`${pillar.type}-nayin`} role="cell" className={`bazi-cell bazi-nayin band-nayin${element ? ` wx-${element}` : ''}`}>{pillar.naYin}</div>
            );
          })}
        </>
      )}
      {showShenSha && (
        <>
          <div role="rowheader" className="bazi-cell is-label band-sha">神煞</div>
          {pillars.map(pillar => (
            <div key={`${pillar.type}-sha`} role="cell" className="bazi-cell is-stack band-sha" data-testid={`bazi-shensha-${pillar.type}`}>
              <div className="bazi-stack">
                {pillar.shenSha.map((name, index) => (
                  <span key={`${name}-${index}`}>{name}</span>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
