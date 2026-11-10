/**
 * AI 追问：无密钥时接口给出明确错误且不泄露堆栈；
 * 有密钥时 mock DeepSeek，请求体要带盘面上下文和免责要求。
 * 跑: npx tsx scripts/regression/ai-interpret.test.ts
 */
import { readFileSync } from 'node:fs';
import { generateChart } from '../../lib/ziwei/algorithm';
import { buildAiChartContext } from '../../lib/ziwei/ai-chart-context';
import { buildBaziAiContext } from '../../lib/bazi/ai-context';
import { castBazi } from '../../lib/bazi/cast';
import { AI_DISCLAIMER, AI_ERRORS, CHAT_TURN_LIMITS, DEEPSEEK_CHAT_COMPLETIONS_URL } from '../../lib/ziwei/ai-interpret';
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
  if (system.includes('这是一张八字盘')) fail('紫微请求被写成了八字盘');
  else ok('紫微请求没有串成八字盘');

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

{
  let baziBody = '';
  globalThis.fetch = (async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    baziBody = typeof init?.body === 'string' ? init.body : '';
    return new Response(JSON.stringify({
      choices: [{ message: { content: '这步大运宜把已经上手的事做完。' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  const bazi = castBazi({
    gender: 'female',
    calendar: 'solar',
    birthDate: '1990-08-15',
    birthTime: '08:00',
    leapMonth: false,
    sect: 2,
    trueSolar: false,
    timeBasis: 'standard',
  });
  const baziContext = buildBaziAiContext(bazi, 1, 1998);
  const baziRes = await readJson(await post({
    school: 'bazi',
    messages: [{ role: 'user', content: '这步大运宜守还是宜动？' }],
    context: baziContext,
  }));
  let baziSystem = '';
  try {
    const body = JSON.parse(baziBody) as { messages?: { role?: string; content?: string }[] };
    baziSystem = body.messages?.find(message => message.role === 'system')?.content ?? '';
  } catch {
    baziSystem = '';
  }
  if (baziBody.includes(secret)) fail('八字模型请求体含密钥');
  if (!baziSystem.includes('这是一张八字盘') || !baziSystem.includes(bazi.pillars[0].ganZhi) || !baziSystem.includes(AI_DISCLAIMER)) {
    fail('八字请求没有带上四柱和免责要求');
  } else if (baziSystem.includes('不要改用十二宫') === false) {
    fail('八字请求没有禁止串到紫微宫位');
  } else if (baziRes.status !== 200 || typeof baziRes.json?.reply !== 'string' || !String(baziRes.json.reply).includes(AI_DISCLAIMER)) {
    fail('八字首条回复没有免责');
  } else if (baziRes.text.includes(secret)) {
    fail('八字响应含密钥');
  } else ok('八字请求与紫微隔离，并带四柱和免责');

  const mixed = await readJson(await post({
    school: 'bazi',
    messages: [{ role: 'user', content: '看看' }],
    context: daxian,
  }));
  if (mixed.status === 500 || mixed.json?.error !== AI_ERRORS.needBazi) fail('把紫微盘塞进八字请求时没有拒绝');
  else ok('八字接口拒绝紫微盘上下文');
}

{
  const followChart = castBazi({
    gender: 'male',
    calendar: 'solar',
    birthDate: '1993-04-04',
    birthTime: '23:30',
    leapMonth: false,
    sect: 2,
    trueSolar: true,
    longitude: 113.3,
  });
  const decadeIndex = followChart.decades.findIndex(item => item.years.some(year => year.year === 2026));
  const followContext = buildBaziAiContext(followChart, decadeIndex, 2026);
  const longBody = '这步大运宜守成，不宜同时另起一条线。'.repeat(50);
  if (longBody.length <= CHAT_TURN_LIMITS.user) fail(`回归样本没有超过用户上限: ${longBody.length}`);
  let followSystem = '';
  globalThis.fetch = (async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    followSystem = '';
    const raw = typeof init?.body === 'string' ? init.body : '';
    if (raw.includes(secret)) fail('多轮请求体含密钥');
    try {
      const body = JSON.parse(raw) as { messages?: { role?: string; content?: string }[] };
      followSystem = body.messages?.find(message => message.role === 'system')?.content ?? '';
    } catch {
      followSystem = '';
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: longBody } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const turns: { role: 'user' | 'assistant'; content: string }[] = [];
  const ask = async (text: string) => {
    turns.push({ role: 'user', content: text });
    const res = await readJson(await post({ school: 'bazi', messages: turns, context: followContext }));
    return res;
  };

  const round1 = await ask('这步大运宜守还是宜动？');
  if (round1.status !== 200 || typeof round1.json?.reply !== 'string' || round1.json.reply.length <= 800) {
    fail(`首轮没有返回超过 800 字的回复: ${round1.status}`);
  } else if (!String(round1.json.reply).includes(AI_DISCLAIMER) || !followSystem.includes('这是一张八字盘')) {
    fail('首轮回复或八字上下文不对');
  } else {
    turns.push({ role: 'assistant', content: String(round1.json.reply) });
    ok(`首轮成功，回复 ${String(round1.json.reply).length} 字`);
  }

  const round2 = await ask('可以');
  if (round2.json?.error === AI_ERRORS.badRequest || round2.status !== 200) {
    fail(`快捷按钮「可以」仍被拒绝: ${round2.status} ${round2.json?.error ?? ''}`);
  } else if (!followSystem.includes('这是一张八字盘') || followSystem.includes('不要写成星曜名词词典')) {
    fail('第二轮快捷追问串到了紫微提示');
  } else {
    turns.push({ role: 'assistant', content: String(round2.json?.reply) });
    ok('第二轮快捷按钮不再格式错误，且仍是八字');
  }

  const round3 = await ask('按这个往细说');
  if (round3.json?.error === AI_ERRORS.badRequest || round3.status !== 200) {
    fail(`手输第二句仍被拒绝: ${round3.status} ${round3.json?.error ?? ''}`);
  } else {
    turns.push({ role: 'assistant', content: String(round3.json?.reply) });
    ok('第二轮手输不再格式错误');
  }

  const round4 = await ask('为什么之前会格式不对');
  if (round4.json?.error === AI_ERRORS.badRequest || round4.status !== 200) {
    fail(`第三轮仍被拒绝: ${round4.status} ${round4.json?.error ?? ''}`);
  } else if (!followSystem.includes(followChart.pillars[0].ganZhi)) {
    fail('第三轮请求丢掉了四柱');
  } else ok('第三轮仍成功，school 仍是八字');

  const tooLongUser = await readJson(await post({
    school: 'bazi',
    messages: [{ role: 'user', content: '问'.repeat(CHAT_TURN_LIMITS.user + 1) }],
    context: followContext,
  }));
  if (tooLongUser.json?.error !== AI_ERRORS.badRequest) fail('超长用户输入没有被拒绝');
  else ok('超过 800 字的用户输入仍会拒绝');
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
