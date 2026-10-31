'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildAiChartContext, type AiView } from '@/lib/ziwei/ai-chart-context';
import { hasReadableChart } from '@/lib/ziwei/fixed-reading';
import type { Palace, ZiweiChart } from '@/lib/ziwei/types';

interface InsightChatProps {
  chart?: ZiweiChart | null;
  timeView?: AiView;
  liunianYear?: number;
  selectedPalace?: Palace | null;
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
}: InsightChatProps) {
  const ready = hasReadableChart(chart);
  const sessionKey = ready
    ? [chart.birthInfo.year, chart.birthInfo.month, chart.birthInfo.day, chart.birthInfo.hour, chart.birthInfo.gender, chart.birthInfo.name ?? ''].join('|')
    : '';
  const context = useMemo(
    () => (ready ? buildAiChartContext(chart, { view: timeView, liunianYear, selectedPalace }) : null),
    [ready, chart, timeView, liunianYear, selectedPalace],
  );

  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
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
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const contextLabel = context
    ? `${context.activeLayer}${context.selectedPalace ? ` · 点中${context.selectedPalace.name}` : ' · 未点宫'}`
    : '未起盘';

  const send = async () => {
    const question = input.trim();
    if (!ready || !context || !question || loading) return;
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
        body: JSON.stringify({
          messages: nextMessages,
          context,
        }),
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
          结合当前本命、大限、流年和点中的宫，回答会落到建议和趋势。对话只留在这个页面里。
        </p>
      ) : (
        <p className="insight-ai-note" data-testid="insight-ai-disabled">
          请先起盘，再向 AI 追问。
        </p>
      )}
      <p className="insight-ai-context" data-testid="insight-ai-context">{contextLabel}</p>

      {(messages.length > 0 || loading) && (
        <div ref={logRef} className="insight-ai-log" aria-live="polite">
          {messages.map((message, index) => (
            <p
              key={`${message.role}-${index}`}
              className={message.role === 'user' ? 'insight-ai-msg is-user' : 'insight-ai-msg is-assistant'}
              data-testid={message.role === 'assistant' ? 'insight-ai-reply' : undefined}
            >
              {message.content}
            </p>
          ))}
          {loading && <p className="insight-ai-msg is-assistant">正在想…</p>}
        </div>
      )}

      {error && <p className="insight-ai-error" role="alert" data-testid="insight-ai-error">{error}</p>}

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
          placeholder={ready ? '例如：这一步大限，事业上宜进还是宜守？' : '请先起盘'}
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
