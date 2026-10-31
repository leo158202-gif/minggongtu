'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Palace, ZiweiChart } from '@/lib/ziwei/types';
import type { TimeView } from './TimeNav';
import {
  answerQuickQuestion,
  buildChartReading,
  hasReadableChart,
  type ReadingContext,
} from '@/lib/ziwei/fixed-reading';
import InsightChat from './InsightChat';

interface InsightPanelProps {
  chart?: ZiweiChart | null;
  selectedPalace?: Palace | null;
  timeView?: TimeView;
  liunianYear?: number;
}

export default function InsightPanel({
  chart,
  selectedPalace,
  timeView = 'mingpan',
  liunianYear = new Date().getFullYear(),
}: InsightPanelProps) {
  const [questionId, setQuestionId] = useState<string | null>(null);

  const ctx = useMemo<ReadingContext>(() => ({
    view: timeView,
    liunianYear,
    selectedPalace,
  }), [timeView, liunianYear, selectedPalace]);

  const reading = useMemo(() => (
    hasReadableChart(chart) ? buildChartReading(chart, ctx) : null
  ), [chart, ctx]);

  const answer = useMemo(() => {
    if (!hasReadableChart(chart) || !questionId) return null;
    return answerQuickQuestion(chart, ctx, questionId);
  }, [chart, ctx, questionId]);

  useEffect(() => {
    if (!questionId) return;
    const id = questionId === 'natal' || questionId === 'liunian' || questionId === 'daxian'
      ? `insight-${questionId}`
      : 'insight-answer';
    const frame = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [questionId]);

  return (
    <aside className={reading ? 'insight-panel is-ready' : 'insight-panel'} aria-label="解读" data-testid="insight-panel">
      <header className="insight-panel-head">
        <h2>解读</h2>
        <p className="insight-kicker">上面是固定说明，下面可以继续问</p>
      </header>

      <div className="insight-scroll">
      {!reading ? (
        <div className="insight-empty" data-testid="insight-empty">
          <p className="insight-empty-title">还没有可看的命盘</p>
          <p>
            起盘之后，这里会按盘上的宫位和主星写出本命说明，以及「流年怎么看」「大限怎么看」。
          </p>
          <p>上面的说明是写好的规则，不联网。起盘后可以在下面向 AI 追问。</p>
        </div>
      ) : (
        <>
          <p className="insight-layer" data-testid="insight-layer">
            <span>当前查看</span>
            {reading.layerLabel}
          </p>
          <p className="insight-hint">{reading.layerHint}</p>

          <div className="insight-questions" role="group" aria-label="快捷问题">
            {reading.questions.map(q => {
              const on = questionId === q.id;
              return (
                <button
                  key={q.id}
                  type="button"
                  className={on ? 'is-on' : undefined}
                  aria-pressed={on}
                  onClick={() => setQuestionId(q.id)}
                >
                  {q.label}
                </button>
              );
            })}
          </div>

          {answer && (
            <div className="insight-answer" id="insight-answer" data-testid="insight-answer">
              <h3>回答</h3>
              {answer.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          )}

          {reading.selectedParagraphs && (
            <section className="insight-block" aria-label="点中的宫">
              <h3>点中的宫</h3>
              {reading.selectedParagraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </section>
          )}

          {reading.sections.map(section => (
            <section
              key={section.id}
              id={`insight-${section.id}`}
              className={section.id === reading.activeSectionId ? 'insight-block is-current' : 'insight-block'}
              data-testid={`insight-${section.id}`}
              aria-current={section.id === reading.activeSectionId ? 'true' : undefined}
            >
              <h3>{section.title}</h3>
              {section.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </section>
          ))}

          <p className="insight-foot">以上按当前命盘填入宫位和星曜，没有调用外部解读接口。</p>
        </>
      )}
      </div>
      <InsightChat
        chart={reading ? chart : null}
        timeView={timeView}
        liunianYear={liunianYear}
        selectedPalace={selectedPalace}
      />
    </aside>
  );
}
