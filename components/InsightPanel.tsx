'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AstroAiContext } from '@/lib/astro/ai-context';
import type { BaziAiContext } from '@/lib/bazi/ai-context';
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
  school?: 'ziwei' | 'bazi' | 'astro';
  baziContext?: BaziAiContext | null;
  astroContext?: AstroAiContext | null;
  conversationKey?: string;
}

export default function InsightPanel({
  chart,
  selectedPalace,
  timeView = 'mingpan',
  liunianYear = new Date().getFullYear(),
  school = 'ziwei',
  baziContext = null,
  astroContext = null,
  conversationKey,
}: InsightPanelProps) {
  const [questionId, setQuestionId] = useState<string | null>(null);

  const ctx = useMemo<ReadingContext>(() => ({
    view: timeView,
    liunianYear,
    selectedPalace,
  }), [timeView, liunianYear, selectedPalace]);

  const reading = useMemo(() => (
    school === 'ziwei' && hasReadableChart(chart) ? buildChartReading(chart, ctx) : null
  ), [chart, ctx, school]);

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

  const preface = (
    <details className="insight-fold" data-testid="insight-summary">
      <summary>{school === 'bazi' ? (baziContext?.readingTarget ?? '还没有八字盘') : school === 'astro' ? (astroContext?.readingTarget ?? '还没有星盘') : (reading?.layerLabel ?? '还没有命盘')}</summary>
      {school === 'astro' ? (
        <div className="insight-block" data-testid="astro-insight">
          <h3>正在看的盘</h3>
          <p>{astroContext?.readingTarget ?? '还没有星盘。'}</p>
          {astroContext && (
            <>
              <p>{astroContext.timeNote}</p>
              <p>{astroContext.limits}</p>
              <p>左边列出行星、宫位和相位。这里不写批文。追问会把这份结构交给模型，用中文说明。</p>
            </>
          )}
        </div>
      ) : school === 'bazi' ? (
        <div className="insight-block" data-testid="bazi-insight">
          <h3>正在解读</h3>
          <p>{baziContext?.readingTarget ?? '还没有八字盘。'}</p>
          {baziContext && (
            <>
              <p>{baziContext.correction}</p>
              <p>子时：{baziContext.sectLabel}。年柱、月柱按节气交换，不按农历初一或公历月初。</p>
              <p>追问只带着这张八字盘。切回紫微斗数后，固定说明仍在，两次对话互不混用。</p>
            </>
          )}
        </div>
      ) : !reading ? (
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
    </details>
  );

  return (
    <aside className={(reading || baziContext || astroContext) ? 'insight-panel is-ready' : 'insight-panel'} aria-label="解读" data-testid="insight-panel">
      <header className="insight-panel-head">
        <h2>解读</h2>
        <p className="insight-kicker">{school === 'bazi' ? '当前解读的是八字盘' : school === 'astro' ? '当前看的是西洋星盘' : '固定说明默认收起，下面可以继续问'}</p>
      </header>
      <InsightChat
        preface={preface}
        chart={school === 'ziwei' ? chart : null}
        timeView={timeView}
        liunianYear={liunianYear}
        selectedPalace={selectedPalace}
        school={school}
        baziContext={school === 'bazi' ? baziContext : null}
        astroContext={school === 'astro' ? astroContext : null}
        conversationKey={conversationKey}
      />
    </aside>
  );
}
