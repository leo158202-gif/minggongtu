import AstroPlaceFields from '@/components/AstroPlaceFields';
import AstroWheel from '@/components/AstroWheel';
import type { AstroChartView, AstroPlaceState, AstroPrompt } from '@/lib/astro/types';
import type { AstroDstChoice } from '@/lib/astro/types';

interface AstroBoardProps {
  chart: AstroChartView | null;
  error: string | null;
  prompt: AstroPrompt | null;
  place: AstroPlaceState;
  casting: boolean;
  onChange: (patch: Partial<AstroPlaceState>) => void;
  onCommit: () => void;
  onChooseDst: (choice: AstroDstChoice) => void;
  onAcceptGap: () => void;
  onRefreshTransit: () => void;
}

export default function AstroBoard({
  chart, error, prompt, place, casting, onChange, onCommit, onChooseDst, onAcceptGap, onRefreshTransit,
}: AstroBoardProps) {
  return (
    <section className="bazi-board astro-board" aria-label="西洋占星" data-testid="astro-board" aria-busy={casting}>
      <p className="bazi-kicker">占星</p>
      <h2>本命盘</h2>
      <AstroPlaceFields place={place} disabled={casting} onChange={onChange} onCommit={onCommit} />
      {casting && <p className="astro-note">正在重排星盘…</p>}
      {error && <p role="alert" className="astro-alert" data-testid="astro-error">{error}</p>}
      {prompt?.kind === 'ambiguous' && (
        <div className="astro-choice" data-testid="astro-dst-choice">
          <p>请选一次。两次都是这个钟面，时差不同，上升会不一样。</p>
          <div role="group" aria-label="选择重叠的一次钟面">
            {prompt.options?.map(option => (
              <button key={option.id} type="button" disabled={casting} onClick={() => onChooseDst(option.id)}>
                {option.id === 'earlier' ? '较早' : '较晚'} · {option.offsetLabel} · {option.dst ? '夏令时' : '标准时'} · 世界时 {option.utcText}
              </button>
            ))}
          </div>
        </div>
      )}
      {prompt?.kind === 'nonexistent' && (
        <div className="astro-choice" data-testid="astro-gap">
          <p>
            拨快后的当地时间大约是 {prompt.shiftedLocalText}（{prompt.offsetLabel}，世界时 {prompt.shiftedUtcText}）。
            只有确认要用这个时刻，才排盘。
          </p>
          <button type="button" disabled={casting} onClick={onAcceptGap}>按拨快后的时刻排盘</button>
        </div>
      )}
      {chart && (
        <>
          <p className="bazi-target" data-testid="astro-asc">{chart.ascendant.text}</p>
          <p className="astro-note" data-testid="astro-time-note">{chart.timeNote}</p>
          <p className="astro-note">{chart.calendarNote} 钟面 {chart.localText}。排盘时刻 {chart.utcText}。{chart.placeText}。</p>
          {chart.polarFallback && (
            <p className="astro-note" data-testid="astro-polar">
              {chart.requestedHouseSystemLabel}在这个纬度不可用，星盘改用{chart.houseSystemLabel}。
            </p>
          )}
          <AstroWheel chart={chart} />
          <p className="astro-legend">
            {chart.planets.map(planet => `${planet.short}${planet.name}`).join('  ')}
            。上升在左侧，星座按逆时针排列。
          </p>
          <div className="astro-angles">
            <p>{chart.ascendant.text}</p>
            <p>{chart.midheaven.text}</p>
            <p>{chart.descendant.text}</p>
            <p>{chart.imumCoeli.text}</p>
          </div>
          <h3>行星落座</h3>
          <table className="astro-table" data-testid="astro-planets">
            <thead>
              <tr><th>星</th><th>星座</th><th>度数</th><th>宫</th><th>状态</th></tr>
            </thead>
            <tbody>
              {chart.planets.map(planet => (
                <tr key={planet.id} data-testid={planet.id === 'sun' ? 'astro-sun' : undefined}>
                  <td>{planet.name}</td>
                  <td>{planet.sign}</td>
                  <td>{planet.signDegText}</td>
                  <td>第{planet.house}宫</td>
                  <td>{[planet.retrograde ? '逆行' : '', planet.dignities !== '—' ? planet.dignities : ''].filter(Boolean).join(' ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>宫位 · {chart.houseSystemLabel}</h3>
          <table className="astro-table">
            <thead>
              <tr><th>宫</th><th>星座</th><th>度数</th></tr>
            </thead>
            <tbody>
              {chart.cusps.map(cusp => (
                <tr key={cusp.house}><td>第{cusp.house}宫</td><td>{cusp.sign}</td><td>{cusp.signDegText}</td></tr>
              ))}
            </tbody>
          </table>
          <h3>相位</h3>
          {chart.aspects.length === 0 ? <p className="astro-note">这次没有落在容许度里的主要相位。</p> : (
            <table className="astro-table" data-testid="astro-aspects">
              <thead>
                <tr><th>相位</th><th>容许</th><th>状态</th></tr>
              </thead>
              <tbody>
                {chart.aspects.map(aspect => (
                  <tr key={`${aspect.a}-${aspect.b}-${aspect.name}`}>
                    <td>{aspect.aName} {aspect.name} {aspect.bName}</td>
                    <td>{aspect.orbText}</td>
                    <td>{aspect.phase}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h3>此刻行运</h3>
          {chart.transits ? (
            <div data-testid="astro-transits">
              <p className="astro-note">行运时刻 {chart.transits.utcText}。这是排盘当时的一张快照。</p>
              <button type="button" disabled={casting} onClick={onRefreshTransit}>刷新行运</button>
              <table className="astro-table">
                <tbody>
                  {chart.transits.bodies.map(body => (
                    <tr key={body.id}><td>{body.text}</td></tr>
                  ))}
                </tbody>
              </table>
              {chart.transits.aspects.length > 0 && (
                <table className="astro-table">
                  <tbody>
                    {chart.transits.aspects.map(aspect => (
                      <tr key={aspect.text}><td>{aspect.text}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : <p className="astro-note">行运没有算出。</p>}
          {chart.warnings.map(warning => <p key={warning} className="astro-note">{warning}</p>)}
          {chart.unavailable.map(item => <p key={item} className="astro-note">{item}</p>)}
          <p className="bazi-credit">
            位置和相位来自 Caelus {chart.engineVersion}（MIT）。度数显示到角分，本站没有用另一套星历独立复算。这里没有批文。合盘这一轮没有做。
          </p>
        </>
      )}
    </section>
  );
}
