'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SafeMarkdown } from './ChatMarkdown';
import type { AstroAiContext } from '@/lib/astro/ai-context';
import type { BaziAiContext } from '@/lib/bazi/ai-context';
import { buildAiChartContext, type AiView } from '@/lib/ziwei/ai-chart-context';
import { hasReadableChart } from '@/lib/ziwei/fixed-reading';
import type { Palace, ZiweiChart } from '@/lib/ziwei/types';

interface InsightChatProps {
  chart?: ZiweiChart | null;
  timeView?: AiView;
  liunianYear?: number;
  selectedPalace?: Palace | null;
  school?: 'ziwei' | 'bazi' | 'astro';
  baziContext?: BaziAiContext | null;
  astroContext?: AstroAiContext | null;
  conversationKey?: string;
  preface?: ReactNode;
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const GENERIC_ERROR = '解读失败，请稍后再试。';

export default function InsightChat({
  chart,
  timeView = 'mingpan',
  liunianYear = new Date().getFullYear(),
  selectedPalace,
  school = 'ziwei',
  baziContext = null,
  astroContext = null,
  conversationKey,
  preface,
}: InsightChatProps) {
  const ziweiReady = school === 'ziwei' && hasReadableChart(chart);
  const baziReady = school === 'bazi' && !!baziContext;
  const astroReady = school === 'astro' && !!astroContext;
  const ready = ziweiReady || baziReady || astroReady;
  const birthKey = ziweiReady
    ? [chart.birthInfo.year, chart.birthInfo.month, chart.birthInfo.day, chart.birthInfo.hour, chart.birthInfo.gender, chart.birthInfo.name ?? ''].join('|')
    : '';
  const sessionKey = conversationKey ?? (ready ? `${school}|${birthKey}` : school);
  const context = useMemo(
    () => (ziweiReady ? buildAiChartContext(chart, { view: timeView, liunianYear, selectedPalace }) : null),
    [ziweiReady, chart, timeView, liunianYear, selectedPalace],
  );

  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const sessionRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    sessionRef.current += 1;
    abortRef.current?.abort();
    setMessages([]);
    setInput('');
    setError(null);
    setLoading(false);
  }, [sessionKey]);

  useEffect(() => {
    const el = logRef.current;
    if (!el || !stickRef.current) return;
    if (el.scrollHeight > el.clientHeight + 8) {
      el.scrollTop = el.scrollHeight;
      return;
    }
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
  }, [messages, loading]);

  const contextLabel = school === 'bazi'
    ? (baziContext?.readingTarget ?? '未起盘')
    : school === 'astro'
      ? (astroContext?.readingTarget ?? '未起盘')
      : (context
        ? `${context.activeLayer}${context.selectedPalace ? ` · 点中${context.selectedPalace.name}` : ' · 未点宫'}`
        : '未起盘');

  const send = async (preset?: string) => {
    const question = (preset ?? input).trim();
    if (!ready || !question || loading) return;
    if (school === 'bazi' ? !baziContext : school === 'astro' ? !astroContext : !context) return;
    const nextMessages: Turn[] = [...messages, { role: 'user', content: question }];
    const seq = sessionRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(school === 'bazi'
          ? { school: 'bazi', messages: nextMessages, context: baziContext }
          : school === 'astro'
            ? { school: 'astro', messages: nextMessages, context: astroContext }
            : { school: 'ziwei', messages: nextMessages, context }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (seq !== sessionRef.current) return;
      if (!res.ok) {
        setError(safeErrorMessage(data && typeof data === 'object' ? (data as { error?: unknown }).error : null));
        return;
      }
      const reply = data && typeof data === 'object' ? (data as { reply?: unknown }).reply : null;
      if (typeof reply !== 'string' || !reply.trim()) {
        setError(GENERIC_ERROR);
        return;
      }
      setMessages(prev => [...prev, { role: 'assistant', content: reply.trim() }]);
    } catch (err) {
      if (isAbort(err) || seq !== sessionRef.current) return;
      setError('网络连不上，请稍后再试。');
    } finally {
      if (seq === sessionRef.current) setLoading(false);
    }
  };

  return (
    <section className="insight-ai" aria-label="AI 追问" data-testid="insight-ai">
      <h3>AI 追问</h3>
      {ready ? (
        <p className="insight-ai-note">
          {school === 'bazi'
            ? (baziContext?.selectedDecade.includes('未选')
              ? '当前只看本命四柱。你选了大运或流年之后，回答才跟着那一步。这段对话和紫微分开。'
              : '结合当前四柱和你选中的大运、流年，回答会落到建议和趋势。这段对话和紫微分开。')
            : school === 'astro'
              ? (astroContext?.transits.some(line => line.includes('未打开行运'))
                ? '当前只看本命星盘。打开行运之后，回答才使用那张快照。这段对话和紫微、八字分开。'
                : '结合这张本命星盘和你打开的行运快照。回答是结构说明，不是批文。')
              : (timeView === 'mingpan'
                ? '当前只看本命。打开大限或流年之后，回答才跟着那一层。对话只留在这个页面里。'
                : '结合你打开的大限或流年，以及点中的宫。回答会落到建议和趋势。')}
        </p>
      ) : (
        <p className="insight-ai-note" data-testid="insight-ai-disabled">
          请先起盘，再向 AI 追问。
        </p>
      )}
      <p className="insight-ai-context" data-testid="insight-ai-context">{contextLabel}</p>

      <div
        ref={logRef}
        className="insight-ai-log"
        aria-live="polite"
        data-testid="insight-ai-log"
        onScroll={event => {
          const el = event.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
        }}
      >
        {preface}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={message.role === 'user' ? 'insight-ai-msg is-user' : 'insight-ai-msg is-assistant'}
            data-testid={message.role === 'assistant' ? 'insight-ai-reply' : 'insight-ai-user'}
          >
            <SafeMarkdown text={message.content} />
          </div>
        ))}
        {loading && <p className="insight-ai-msg is-assistant">正在想…</p>}
      </div>

      {error && <p className="insight-ai-error" role="alert" data-testid="insight-ai-error">{error}</p>}

      {ready && !loading && messages.some(message => message.role === 'assistant') && (
        <div className="insight-ai-quick" role="group" aria-label="快捷追问">
          <button type="button" data-testid="insight-ai-quick-ok" onClick={() => void send('可以')}>可以</button>
          <button type="button" data-testid="insight-ai-quick-detail" onClick={() => void send('按这个往细说')}>按这个往细说</button>
        </div>
      )}

      <form
        className="insight-ai-form"
        onSubmit={event => {
          event.preventDefault();
          void send();
        }}
      >
        <textarea
          id="insight-ai-input"
          data-testid="insight-ai-input"
          aria-label="向 AI 追问"
          value={input}
          maxLength={800}
          rows={3}
          disabled={!ready || loading}
          placeholder={ready ? (school === 'bazi' ? '例如：这一步大运，工作上宜守还是宜动？' : school === 'astro' ? '例如：上升和太阳的配置，工作上宜怎么看？' : '例如：这一步大限，事业上宜进还是宜守？') : '请先起盘'}
          onChange={event => setInput(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" data-testid="insight-ai-send" disabled={!ready || loading || !input.trim()}>
          发送
        </button>
      </form>
    </section>
  );
}

function safeErrorMessage(value: unknown): string {
  if (typeof value !== 'string') return GENERIC_ERROR;
  const text = value.trim();
  if (!text || text.length > 120) return GENERIC_ERROR;
  if (/stack|node_modules|Bearer\s+|api\.deepseek/i.test(text)) return GENERIC_ERROR;
  return text;
}

function isAbort(err: unknown): boolean {
  return !!err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'AbortError';
}
