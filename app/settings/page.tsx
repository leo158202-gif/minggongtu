'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [configured, setConfigured] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState('正在读取本机设置…');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch('/api/settings/ai');
      const data = await response.json().catch(() => null) as { configured?: boolean; baseUrl?: string; model?: string; error?: string } | null;
      if (cancelled) return;
      if (!response.ok) {
        setStatus(data?.error || '现在读不到本机设置。');
        return;
      }
      setConfigured(Boolean(data?.configured));
      setBaseUrl(data?.baseUrl ?? '');
      setModel(data?.model ?? '');
      setStatus(data?.configured ? '密钥已保存在这台电脑，页面不会显示完整密钥。' : '还没有密钥。填好后，追问才会开始。');
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (clearKey = false) => {
    setError('');
    const response = await fetch('/api/settings/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, baseUrl, model, clearKey }),
    });
    const data = await response.json().catch(() => null) as { ok?: boolean; configured?: boolean; error?: string } | null;
    if (!response.ok || !data?.ok) {
      setError(data?.error || '没有保存。');
      return;
    }
    setApiKey('');
    setConfigured(Boolean(data.configured));
    setStatus(data.configured ? '已保存。密钥只留在本机，这里不再显示。' : '已清除本机密钥。');
  };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--tx-1)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--bdr)' }}>
        <Link href="/bazi" style={{ color: 'var(--ac)', textDecoration: 'none' }}>返回排盘</Link>
      </header>
      <section style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px 64px' }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>AI 设置</h1>
        <p data-testid="ai-status" style={{ color: 'var(--tx-2)', lineHeight: 1.7 }}>{status}</p>
        <form
          onSubmit={event => { event.preventDefault(); void save(false); }}
          style={{ display: 'grid', gap: 14, marginTop: 20 }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            AI 密钥
            <input
              data-testid="ai-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              placeholder={configured ? '已保存。要更换再填写，留空则不改' : '必填'}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--bdr)' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            接口地址（可选）
            <input
              data-testid="ai-base"
              value={baseUrl}
              onChange={event => setBaseUrl(event.target.value)}
              placeholder="留空则使用 DeepSeek 官方地址"
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--bdr)' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            模型名（可选）
            <input
              data-testid="ai-model"
              value={model}
              onChange={event => setModel(event.target.value)}
              placeholder="留空则使用 deepseek-chat"
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--bdr)' }}
            />
          </label>
          {error && <p role="alert" style={{ color: 'var(--ji)' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button data-testid="ai-save" type="submit" style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid var(--ac-bdr)', background: 'var(--ac-bg)', color: 'var(--ac)' }}>保存</button>
            {configured && (
              <button data-testid="ai-clear" type="button" onClick={() => void save(true)} style={{ padding: '8px 16px', borderRadius: 999 }}>清除密钥</button>
            )}
          </div>
        </form>
        <p style={{ marginTop: 24, color: 'var(--tx-3)', fontSize: 13, lineHeight: 1.7 }}>
          密钥写在这台电脑的用户目录，不会放进网页安装包，也不会出现在日志里。接口需要兼容 OpenAI 的 chat completions。排盘本身不需要密钥。
        </p>
      </section>
    </main>
  );
}
