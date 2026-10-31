/**
 * AI 追问：无密钥时接口给出明确错误且不泄露堆栈；
 * 有密钥时 mock DeepSeek，请求体要带盘面上下文和免责要求。
 * 跑: npx tsx scripts/regression/ai-interpret.test.ts
 */
import { readFileSync } from 'node:fs';
import { generateChart } from '../../lib/ziwei/algorithm';
import { buildAiChartContext } from '../../lib/ziwei/ai-chart-context';
import { AI_DISCLAIMER, AI_ERRORS, DEEPSEEK_CHAT_COMPLETIONS_URL } from '../../lib/ziwei/ai-interpret';
import { POST } from '../../app/api/interpret/route';
import type { BirthInfo } from '../../lib/ziwei/types';

let failures = 0;
const fail = (msg: string) => { console.error(`  ✗ ${msg}`); failures++; };
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

const birth: BirthInfo = { year: 1990, month: 8, day: 15, hour: 3, gender: 'female', name: '测试' };
const chart = generateChart(birth);
const picked = chart.palaces.find(palace => palace.name === '夫妻') ?? chart.palaces[0];
const daxian = buildAiChartContext(chart, { view: 'daxian', liunianYear: 2026, selectedPalace: picked });
const liunianPalace = chart.palaces.find(palace => palace.name === '官禄') ?? chart.palaces[1];
const liunian = buildAiChartContext(chart, { view: 'liunian', liunianYear: 2031, selectedPalace: liunianPalace });

const question = '这一步事业上宜进还是宜守？';
const secret = ['test', 'only', 'not', 'a', 'secret'].join('-');
const originalFetch = globalThis.fetch;
const originalKey = process.env.MINGGONGTU_AI_API_KEY;

function post(body: unknown): Promise<Response> {
  return POST(new Request('http://local/api/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function leaksStack(text: string): boolean {
  return /node_modules|node:internal|\n\s+at\s+\S+|Error:\s/.test(text) || text.includes(secret);
}

async function readJson(res: Response): Promise<{ status: number; text: string; json: Record<string, unknown> | null }> {
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(text) as unknown;
    json = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

async function main() {
delete process.env.MINGGONGTU_AI_API_KEY;
{
  const missing = await readJson(await post({ messages: [{ role: 'user', content: question }], context: daxian }));
  if (missing.status === 500 || missing.status < 400) fail(`无密钥时状态不对: ${missing.status}`);
  else if (!missing.json || missing.json.error !== AI_ERRORS.missingKey) fail('无密钥时没有明确的中文错误');
  else if ('stack' in missing.json || leaksStack(missing.text)) fail('无密钥时响应泄露了堆栈');
  else ok('无密钥时返回明确错误，且没有堆栈');

  process.env.MINGGONGTU_AI_API_KEY = '   ';
  const blank = await readJson(await post({ messages: [{ role: 'user', content: question }], context: daxian }));
  if (blank.json?.error !== AI_ERRORS.missingKey) fail('空白密钥被当成已配置');
  else ok('空白密钥视为未配置');
}

process.env.MINGGONGTU_AI_API_KEY = secret;
{
  const bad = await readJson(await POST(new Request('http://local/api/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  })));
  if (bad.status === 500 || bad.json?.error !== AI_ERRORS.badRequest || leaksStack(bad.text)) fail('坏 JSON 没有收成可读错误');
  else ok('坏 JSON 返回可读错误');
}

{
  let capturedUrl = '';
  let capturedAuth = '';
  let capturedBody = '';
  globalThis.fetch = (async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    capturedUrl = String(url);
    const headers = new Headers(init?.headers);
    capturedAuth = headers.get('authorization') ?? '';
    capturedBody = typeof init?.body === 'string' ? init.body : '';
    return new Response(JSON.stringify({
      choices: [{ message: { content: '这十年宜把一件已经上手的事做完，不宜同时开两条新线。' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const starred = chart.palaces.flatMap(palace => palace.stars).find(star => star.type === 'major' && star.brightnessRaw);
  const withHua = daxian.natalSihua[0];
  const res = await readJson(await post({
    messages: [{ role: 'user', content: question }],
    context: daxian,
  }));

  if (capturedUrl !== DEEPSEEK_CHAT_COMPLETIONS_URL) fail(`没有请求 DeepSeek 官方接口: ${capturedUrl}`);
  else ok('请求打到 DeepSeek chat completions');

  if (capturedAuth !== `Bearer ${secret}`) fail('Authorization 头不正确');
  else ok('密钥只出现在服务端 Authorization 头');

  if (capturedBody.includes(secret)) fail('密钥写进了模型请求体');
  else ok('模型请求体不含密钥');

  let system = '';
  try {
    const body = JSON.parse(capturedBody) as { messages?: { role?: string; content?: string }[] };
    system = body.messages?.find(message => message.role === 'system')?.content ?? '';
  } catch {
    system = '';
  }
  if (!system.includes(AI_DISCLAIMER)) fail('请求体没有免责要求');
  else ok('请求体要求首条回复带免责');
  if (!system.includes(daxian.activeLayer) || !daxian.activeLayer.includes('大限')) fail(`请求体没有当前大限层: ${daxian.activeLayer}`);
  else ok(`请求体带当前大限层 ${daxian.activeLayer}`);
  if (!system.includes(picked.name)) fail('请求体没有点中的宫');
  else ok(`请求体带点中的宫 ${picked.name}`);
  if (!starred || !system.includes(starred.name) || !system.includes(starred.brightnessRaw!)) {
    fail('请求体没有主星亮度');
  } else ok(`请求体带主星亮度 ${starred.name} ${starred.brightnessRaw}`);
  if (!withHua || !system.includes(withHua.star) || !system.includes(`化${withHua.siHua}`)) {
    fail('请求体没有生年四化');
  } else ok(`请求体带生年四化 ${withHua.star}化${withHua.siHua}`);
  if (!system.includes('不要写成星曜名词词典')) fail('请求体没有建议 / 趋势的风格要求');
  else ok('请求体要求落到建议和趋势，而不是名词词典');

  if (res.status !== 200 || res.json?.reply !== `${AI_DISCLAIMER}。\n这十年宜把一件已经上手的事做完，不宜同时开两条新线。`) {
    fail('首条回复没有补上免责');
  } else if (res.text.includes(secret) || leaksStack(res.text)) fail('成功响应泄露了密钥或堆栈');
  else ok('首条回复含免责，且响应不含密钥');

  const follow = await readJson(await post({
    messages: [
      { role: 'user', content: question },
      { role: 'assistant', content: `${AI_DISCLAIMER}。\n先守。` },
      { role: 'user', content: '那今年呢？' },
    ],
    context: liunian,
  }));
  let followSystem = '';
  try {
    const body = JSON.parse(capturedBody) as { messages?: { role?: string; content?: string }[] };
    followSystem = body.messages?.find(message => message.role === 'system')?.content ?? '';
  } catch {
    followSystem = '';
  }
  if (!followSystem.includes(liunian.activeLayer) || !followSystem.includes(String(2031)) || !followSystem.includes(liunianPalace.name)) {
    fail('切换流年和宫位后，请求体仍是旧上下文');
  } else if (typeof follow.json?.reply === 'string' && follow.json.reply.startsWith(`${AI_DISCLAIMER}。\n这十年`)) {
    fail('后续回复被重复加上免责');
  } else if (follow.status !== 200) fail(`切换上下文后状态不对: ${follow.status}`);
  else ok(`切换到流年 ${liunian.activeLayer}、点中${liunianPalace.name} 后请求体已更新`);
}

{
  globalThis.fetch = (async () => {
    throw new Error(`connect ECONNREFUSED\n    at DeepSeek.request (node:internal/modules)\n${secret}`);
  }) as typeof fetch;
  const crashed = await readJson(await post({
    messages: [{ role: 'user', content: question }],
    context: daxian,
  }));
  if (crashed.status === 500 || crashed.json?.error !== AI_ERRORS.upstream || leaksStack(crashed.text)) {
    fail('网络失败时错误不可读，或泄露了堆栈 / 密钥');
  } else ok('网络失败返回中文错误，不泄露堆栈和密钥');
}

{
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: secret }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;
  const denied = await readJson(await post({
    messages: [{ role: 'user', content: question }],
    context: daxian,
  }));
  if (denied.text.includes(secret) || denied.json?.error !== AI_ERRORS.upstream) fail('上游错误原文被透传');
  else ok('上游错误不透传，也不带密钥');
}

globalThis.fetch = originalFetch;
if (originalKey === undefined) delete process.env.MINGGONGTU_AI_API_KEY;
else process.env.MINGGONGTU_AI_API_KEY = originalKey;

const example = readFileSync('.env.example', 'utf8');
const exampleLine = example.split('\n').find(line => line.startsWith('MINGGONGTU_AI_API_KEY='));
if (exampleLine !== 'MINGGONGTU_AI_API_KEY=') fail(`.env.example 密钥行应为空白赋值，实际是「${exampleLine ?? '缺失'}」`);
else ok('.env.example 只声明空的 MINGGONGTU_AI_API_KEY');

const routeSrc = readFileSync('app/api/interpret/route.ts', 'utf8');
const serverSrc = readFileSync('lib/ziwei/ai-interpret.ts', 'utf8');
const clientSrc = readFileSync('components/InsightChat.tsx', 'utf8');
if (/console\.(log|debug|info|warn|error)/.test(routeSrc + serverSrc)) fail('服务端代码会把信息打进日志');
else ok('服务端解读路径没有日志输出');
if (/process\.env|Authorization|api\.deepseek\.com/.test(clientSrc)) fail('浏览器代码出现密钥或上游地址');
else ok('浏览器代码不读密钥，也不直连 DeepSeek');
if (!clientSrc.includes("fetch('/api/interpret'")) fail('追问没有走服务端路由');
else ok('追问走 /api/interpret');

if (failures) {
  console.error(`\n${failures} 项失败`);
  process.exit(1);
}
console.log('\nAI 追问接口通过');
}

main().catch(err => {
  const raw = err instanceof Error ? err.message : 'unknown';
  console.error(`\n测试运行失败: ${raw.split(secret).join('[redacted]')}`);
  process.exit(1);
});
