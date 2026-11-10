/**
 * 本机 AI 设置：假密钥只写临时文件，请求打到假地址，不调用真实模型。
 * 跑: npx tsx scripts/regression/ai-settings.test.ts
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { POST as interpret } from '../../app/api/interpret/route';
import { GET, POST } from '../../app/api/settings/ai/route';
import { chatCompletionsUrl } from '../../lib/ziwei/ai-settings';
import { AI_ERRORS } from '../../lib/ziwei/ai-interpret';

const dir = mkdtempSync(path.join(tmpdir(), 'mgt-settings-'));
const file = path.join(dir, 'ai-settings.json');
process.env.MINGGONGTU_AI_CONFIG = file;
const envKey = 'env-key-should-not-win';
const localKey = 'local-fake-key-not-real';
process.env.MINGGONGTU_AI_API_KEY = envKey;

let failures = 0;
const fail = (msg: string) => { console.error(`  ✗ ${msg}`); failures++; };
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

const originalFetch = globalThis.fetch;

function localRequest(url: string, host: string, body?: unknown): Request {
  return new Request(url, {
    method: body ? 'POST' : 'GET',
    headers: { host, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function main() {
if (chatCompletionsUrl('') .endsWith('/chat/completions') && chatCompletionsUrl('https://example.test/v1') === 'https://example.test/v1/chat/completions') {
  ok('空地址用官方接口，自填地址补上 chat completions');
} else fail('接口地址拼接不对');

{
  const saved = await POST(localRequest('http://127.0.0.1:3210/api/settings/ai', '127.0.0.1:3210', {
    apiKey: localKey,
    baseUrl: 'http://127.0.0.1:9/v1',
    model: 'fake-model',
  }));
  const json = await saved.json() as { ok?: boolean; configured?: boolean; apiKey?: string };
  const raw = readFileSync(file, 'utf8');
  if (!json.ok || !json.configured || 'apiKey' in json || JSON.stringify(json).includes(localKey)) fail('保存响应带回了密钥');
  else if (!raw.includes(localKey)) fail('假密钥没有写入临时文件');
  else ok('设置页保存成功，响应不含密钥');
}

{
  const viewed = await GET(localRequest('http://127.0.0.1:3210/api/settings/ai', '127.0.0.1:3210'));
  const json = await viewed.json() as { configured?: boolean; baseUrl?: string; model?: string; apiKey?: string };
  if (!json.configured || json.baseUrl !== 'http://127.0.0.1:9/v1' || json.model !== 'fake-model' || json.apiKey || JSON.stringify(json).includes(localKey)) {
    fail(`读取设置回显了密钥或丢了地址: ${JSON.stringify(json)}`);
  } else ok('读取只说明已保存，并带回地址和模型名');
}

{
  const before = readFileSync(file, 'utf8');
  const denied = await POST(localRequest('http://example.com/api/settings/ai', 'example.com', { apiKey: 'other-key' }));
  if (denied.status !== 403 || readFileSync(file, 'utf8') !== before) fail('非本机请求改动了密钥文件');
  else ok('非本机不能保存密钥');
}

{
  let capturedUrl = '';
  let capturedAuth = '';
  globalThis.fetch = (async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    capturedUrl = String(url);
    capturedAuth = new Headers(init?.headers).get('authorization') ?? '';
    return new Response(JSON.stringify({
      choices: [{ message: { content: '仅供参考、非绝对预言。这是假回复。' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  const response = await interpret(new Request('http://127.0.0.1:3210/api/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      school: 'bazi',
      messages: [{ role: 'user', content: '看看' }],
      context: {
        school: 'bazi',
        readingTarget: '八字本命',
        calendarLabel: '公历',
        sectLabel: '晚子时',
        trueSolar: false,
        timeBasisLabel: '标准',
        correction: '无',
        dayMaster: '丁',
        dayMasterElement: '火',
        pillars: ['年柱', '月柱', '日柱', '时柱'].map((label, index) => ({
          label,
          ganZhi: ['戊辰', '己未', '丁丑', '壬寅'][index],
          naYin: '',
          wuXing: '',
          mainStar: '',
          cangGan: '',
        })),
        fiveElements: '',
        decades: [],
        selectedDecade: '未选大运，当前看本命',
        selectedYear: '未选流年，当前看本命',
      },
    }),
  }));
  const text = await response.text();
  if (capturedUrl !== 'http://127.0.0.1:9/v1/chat/completions') fail(`没有走本机地址: ${capturedUrl}`);
  else if (capturedAuth !== `Bearer ${localKey}` || capturedAuth.includes(envKey)) fail('请求没有优先使用本机密钥');
  else if (text.includes(localKey) || text.includes(envKey)) fail('响应里出现了密钥');
  else ok('追问优先用本机密钥和地址，响应不带回密钥');
  globalThis.fetch = originalFetch;
}

{
  const cleared = await POST(localRequest('http://127.0.0.1:3210/api/settings/ai', '127.0.0.1:3210', { clearKey: true, baseUrl: '', model: '' }));
  const json = await cleared.json() as { configured?: boolean };
  const missing = await interpret(new Request('http://127.0.0.1:3210/api/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: '看看' }], context: { view: 'mingpan', palaces: [] } }),
  }));
  const body = await missing.json() as { error?: string };
  if (json.configured || body.error !== AI_ERRORS.missingKey) fail(`清除后仍可能去用环境变量: ${body.error}`);
  else ok('清除本机密钥后，即使环境变量里有密钥，也会提示去设置页');
}

if (failures) {
  console.error(`\n${failures} 项失败`);
  process.exit(1);
}
console.log('\n本机 AI 设置通过');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
