/**
 * 西洋占星预览：Caelus 本命盘、夏令时歧义、两轮追问。
 * 度数对齐该库 0.25.0 的公开样例，不是本项目的独立星历复算。
 * 跑: npx tsx scripts/regression/astro-caelus.test.ts
 */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.MINGGONGTU_AI_CONFIG = path.join(mkdtempSync(path.join(tmpdir(), 'mgt-ai-')), 'none.json');
import { buildAstroAiContext } from '../../lib/astro/ai-context';
import { castAstro } from '../../lib/astro/cast';
import { ASTRO_ERRORS } from '../../lib/astro/errors';
import { ASTRO_CITIES, presetForBirthCity } from '../../lib/astro/place';
import { cuspMidpoint, planetSlots, wheelPoint } from '../../lib/astro/wheel';
import { AI_DISCLAIMER, AI_ERRORS, CHAT_TURN_LIMITS } from '../../lib/ziwei/ai-interpret';
import { POST as interpret } from '../../app/api/interpret/route';
import { POST as astroRoute } from '../../app/api/astro/route';
import type { AstroCastInput } from '../../lib/astro/types';

let failures = 0;
const fail = (msg: string) => { console.error(`  ✗ ${msg}`); failures++; };
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

const secret = ['test', 'only', 'not', 'a', 'secret'].join('-');
const originalFetch = globalThis.fetch;
const originalKey = process.env.MINGGONGTU_AI_API_KEY;

function sample(patch: Partial<AstroCastInput> = {}): AstroCastInput {
  return {
    calendar: 'solar',
    year: 1990,
    month: 6,
    day: 10,
    hour: 14,
    minute: 30,
    leapMonth: false,
    timeUnknown: false,
    latitude: 27.95,
    longitude: -82.46,
    zone: 'UTC',
    dstChoice: null,
    acceptGap: false,
    houseSystem: 'placidus',
    transitUtc: '2026-11-10T02:00:00.000Z',
    ...patch,
  };
}

function postInterpret(body: unknown): Promise<Response> {
  return interpret(new Request('http://local/api/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
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

function assertChartSample(): ReturnType<typeof castAstro> {
  const result = castAstro(sample());
  if (!result.ok) {
    fail(`样例盘没有排成: ${result.error}`);
    return result;
  }
  const sun = result.chart.planets.find(item => item.id === 'sun');
  const moon = result.chart.planets.find(item => item.id === 'moon');
  const saturn = result.chart.planets.find(item => item.id === 'saturn');
  if (!sun || sun.text !== '太阳 双子 19°27′ 第11宫') fail(`太阳与 Caelus 0.25.0 样例不一致: ${sun?.text}`);
  else ok('太阳 双子 19°27′ 第11宫');
  if (!moon || !moon.text.startsWith('月亮 摩羯 13°17′')) fail(`月亮与样例不一致: ${moon?.text}`);
  else ok('月亮 摩羯 13°17′');
  if (result.chart.ascendant.text !== '上升 狮子 10°54′') fail(`上升与样例不一致: ${result.chart.ascendant.text}`);
  else ok('上升 狮子 10°54′');
  if (result.chart.midheaven.text !== '天顶 金牛 6°02′') fail(`天顶与样例不一致: ${result.chart.midheaven.text}`);
  else ok('天顶 金牛 6°02′');
  if (!saturn?.retrograde || !saturn.text.includes('摩羯 24°18′')) fail('土星逆行没有标出');
  else ok('土星逆行并落在摩羯');
  if (!result.chart.aspects.some(item => item.text.includes('月亮') && item.text.includes('三分') && item.text.includes('金星'))) {
    fail('样例里月亮与金星的三分没有出现');
  } else ok('主要相位用中文');
  if (JSON.stringify(result.chart).includes('Gemini') || JSON.stringify(result.chart.planets).includes('Capricorn')) {
    fail('盘面中文结果里还留着英文星座');
  } else ok('盘面星座是中文');
  if (result.chart.transits?.utcText !== '2026-11-10 02:00:00 世界时') fail(`行运时刻不对: ${result.chart.transits?.utcText}`);
  else if (!result.chart.transits.aspects.length) fail('行运相位是空的');
  else ok('行运快照用指定的世界时');
  if (result.chart.engineVersion !== '0.25.0' || result.chart.engineName !== 'caelus') fail('引擎版本没有固定在 caelus 0.25.0');
  else ok('引擎版本是 caelus 0.25.0');
  return result;
}

async function main() {
  const pkg = JSON.parse(readFileSync('node_modules/caelus/package.json', 'utf8')) as { version?: string; license?: string; dependencies?: Record<string, string> };
  const birth = JSON.parse(readFileSync('node_modules/caelus-birth/package.json', 'utf8')) as { version?: string; license?: string; dependencies?: Record<string, string> };
  const luxon = JSON.parse(readFileSync('node_modules/luxon/package.json', 'utf8')) as { license?: string };
  const tz = JSON.parse(readFileSync('node_modules/tz-lookup/package.json', 'utf8')) as { license?: string };
  if (pkg.version !== '0.25.0' || pkg.license !== 'MIT') fail(`caelus 应为 MIT 0.25.0，实际 ${pkg.version} ${pkg.license}`);
  else ok('caelus 0.25.0 MIT');
  if (birth.version !== '0.25.0' || birth.license !== 'MIT') fail('caelus-birth 许可证或版本不对');
  else ok('caelus-birth 0.25.0 MIT');
  if (luxon.license !== 'MIT' || tz.license !== 'CC0-1.0') fail(`时区依赖许可证不对: luxon ${luxon.license} tz-lookup ${tz.license}`);
  else ok('luxon MIT，tz-lookup CC0');
  const depNames = Object.keys({ ...(pkg.dependencies ?? {}), ...(birth.dependencies ?? {}) }).join(' ');
  if (/swisseph|swiss-ephemeris|agpl/i.test(depNames)) fail(`混入了不允许的星历依赖: ${depNames}`);
  else ok('依赖里没有 Swiss Ephemeris');

  const chartResult = assertChartSample();

  const localTampa = castAstro(sample({ hour: 10, minute: 30, zone: 'America/New_York' }));
  if (!localTampa.ok || localTampa.chart.utcText !== '1990-06-10 14:30:00 世界时' || !localTampa.chart.dst) {
    fail(`纽约夏令时没有把 10:30 换成 14:30 世界时: ${localTampa.ok ? localTampa.chart.utcText : localTampa.error}`);
  } else if (!localTampa.chart.timeNote.includes('夏令时')) fail('夏令时没有写进说明');
  else ok('1990 年 6 月纽约 10:30 按夏令时换成 14:30 世界时');

  const summer = castAstro(sample({
    year: 1988, month: 7, day: 1, hour: 12, minute: 0,
    latitude: 39.9, longitude: 116.4, zone: 'Asia/Shanghai',
  }));
  const winter = castAstro(sample({
    year: 1988, month: 12, day: 1, hour: 12, minute: 0,
    latitude: 39.9, longitude: 116.4, zone: 'Asia/Shanghai',
  }));
  if (!summer.ok || summer.chart.offsetLabel !== 'UTC+9' || !summer.chart.dst || !summer.chart.utcText.startsWith('1988-07-01 03:00:00')) {
    fail(`1988 年北京夏令时没有按 UTC+9: ${summer.ok ? `${summer.chart.offsetLabel} ${summer.chart.utcText}` : summer.error}`);
  } else ok('1988 年 7 月北京时间标出夏令时 UTC+9');
  if (!winter.ok || winter.chart.offsetLabel !== 'UTC+8' || winter.chart.dst || !winter.chart.timeNote.includes('这次不是夏令时')) {
    fail(`1988 年 12 月不该是夏令时: ${winter.ok ? winter.chart.offsetLabel : winter.error}`);
  } else ok('1988 年 12 月北京时间是 UTC+8');

  const ambiguous = castAstro(sample({
    year: 2024, month: 11, day: 3, hour: 1, minute: 30,
    latitude: 40.7128, longitude: -74.006, zone: 'America/New_York',
  }));
  if (ambiguous.ok || ambiguous.prompt?.kind !== 'ambiguous' || ambiguous.prompt.options?.length !== 2) {
    fail('重叠的 1:30 被直接排成了盘');
  } else ok('夏令时回拨的 1:30 先不排盘');
  const earlier = castAstro(sample({
    year: 2024, month: 11, day: 3, hour: 1, minute: 30,
    latitude: 40.7128, longitude: -74.006, zone: 'America/New_York', dstChoice: 'earlier',
  }));
  const later = castAstro(sample({
    year: 2024, month: 11, day: 3, hour: 1, minute: 30,
    latitude: 40.7128, longitude: -74.006, zone: 'America/New_York', dstChoice: 'later',
  }));
  const ambiguousUtc = !ambiguous.ok && ambiguous.prompt?.kind === 'ambiguous'
    ? (ambiguous.prompt.options?.[0]?.utcText ?? '')
    : '';
  if (!earlier.ok || !later.ok) fail('选定重叠时刻后没有排成');
  else if (earlier.chart.utcText === later.chart.utcText || earlier.chart.ascendant.text === later.chart.ascendant.text) {
    fail('较早和较晚排成了同一张盘');
  } else if (!ambiguousUtc || !earlier.chart.utcText.startsWith(ambiguousUtc)) {
    fail(`较早的世界时和选项不一致: ${earlier.chart.utcText}`);
  } else if (!earlier.chart.timeNote.includes('你选的是较早')) fail('说明里没有写明用户选了较早的一次');
  else ok('重叠的两次上升不同，并写明所选的一次');

  const gap = castAstro(sample({
    year: 2024, month: 3, day: 10, hour: 2, minute: 30,
    latitude: 40.7128, longitude: -74.006, zone: 'America/New_York',
  }));
  if (gap.ok || gap.prompt?.kind !== 'nonexistent') fail('不存在的 2:30 被直接排盘');
  else ok('春令时拨掉的 2:30 先不排盘');
  const shifted = castAstro(sample({
    year: 2024, month: 3, day: 10, hour: 2, minute: 30,
    latitude: 40.7128, longitude: -74.006, zone: 'America/New_York', acceptGap: true,
  }));
  if (!shifted.ok || shifted.chart.timeStatus !== 'shifted' || !shifted.chart.timeNote.includes('不存在')) {
    fail('确认拨快后没有标明原钟面不存在');
  } else ok('确认后才按拨快的时刻排，并写明原时间不存在');

  const polar = castAstro(sample({ latitude: 78, longitude: 0, zone: 'UTC' }));
  if (!polar.ok || !polar.chart.polarFallback || polar.chart.houseSystemLabel !== '整宫') {
    fail(`高纬普拉西德没有改用整宫: ${polar.ok ? polar.chart.houseSystemLabel : polar.error}`);
  } else ok('高纬普拉西德改用整宫并标明');

  const unknown = castAstro(sample({ timeUnknown: true }));
  if (unknown.ok || unknown.error !== ASTRO_ERRORS.unknownTime) fail('时辰不详仍然排了上升');
  else ok('时辰不详不排星盘');

  const badZone = castAstro(sample({ zone: '上海' }));
  if (badZone.ok || !badZone.error.includes('时区')) fail('非法时区没有中文错误');
  else ok('非法时区返回中文错误');

  const lunar = castAstro(sample({ calendar: 'lunar', year: 1990, month: 5, day: 1, hour: 8, minute: 0, latitude: 39.9, longitude: 116.4, zone: 'Asia/Shanghai' }));
  const solarSameNumbers = castAstro(sample({ year: 1990, month: 5, day: 1, hour: 8, minute: 0, latitude: 39.9, longitude: 116.4, zone: 'Asia/Shanghai' }));
  if (!lunar.ok || !solarSameNumbers.ok) fail('农历样例没有排成');
  else if (lunar.chart.utcText === solarSameNumbers.chart.utcText) fail('农历日期被当成了公历');
  else if (!lunar.chart.calendarNote.includes('已换成公历')) fail('没有说明农历已换成公历');
  else ok('农历先换成公历再排星盘');

  const urumqi = presetForBirthCity('乌鲁木齐');
  const beijingPreset = ASTRO_CITIES.find(item => item.id === 'urumqi-beijing');
  if (!urumqi || urumqi.zone !== 'Asia/Shanghai' || beijingPreset?.zone !== 'Asia/Shanghai') {
    fail('乌鲁木齐预设没有默认北京时间');
  } else {
    const localZone = ASTRO_CITIES.find(item => item.id === 'urumqi-local');
    const byBeijing = castAstro(sample({
      year: 1990, month: 1, day: 1, hour: 8, minute: 0,
      latitude: urumqi.latitude, longitude: urumqi.longitude, zone: urumqi.zone,
    }));
    const byLocal = castAstro(sample({
      year: 1990, month: 1, day: 1, hour: 8, minute: 0,
      latitude: urumqi.latitude, longitude: urumqi.longitude, zone: localZone?.zone ?? '',
    }));
    if (!byBeijing.ok || !byLocal.ok || byBeijing.chart.utcText === byLocal.chart.utcText) fail('乌鲁木齐两种时区没有分开');
    else ok('乌鲁木齐默认北京时间，和乌鲁木齐时间不是同一张盘');
  }

  const ascLeft = wheelPoint(120, 120, 100, 0, 0);
  const below = wheelPoint(210, 120, 100, 0, 0);
  const right = wheelPoint(300, 120, 100, 0, 0);
  if (!(ascLeft.x < -90 && Math.abs(ascLeft.y) < 1)) fail(`上升没有放在左侧: ${ascLeft.x},${ascLeft.y}`);
  else if (!(Math.abs(below.x) < 1 && below.y > 90)) fail(`上升后 90° 没有在下方: ${below.x},${below.y}`);
  else if (!(right.x > 90 && Math.abs(right.y) < 1)) fail('对宫没有在右侧');
  else ok('星盘上升在左，黄经增加走向逆时针');
  const slots = planetSlots([1, 3, 359]);
  if (slots[0] === slots[1] || slots[0] === slots[2]) fail(`靠近的星没有错开: ${slots.join(',')}`);
  else ok('靠近的星会错开');
  if (cuspMidpoint(350, 10) !== 0) fail(`宫头中点绕回失败: ${cuspMidpoint(350, 10)}`);
  else ok('宫头中点能绕过 0°');

  if (!chartResult.ok) {
    fail('没有样例盘，跳不过追问');
  } else {
    const context = buildAstroAiContext(chartResult.chart);
    const opened = buildAstroAiContext(chartResult.chart, true);
    if (!context.transits.some(line => line.includes('未打开行运'))) fail('本命追问仍附带行运');
    else if (!opened.transits.some(line => line.includes('行运时刻'))) fail('打开行运后没有绑定快照');
    else ok('未打开行运时追问只写本命，打开后才绑定快照');
    const parsedRoundTrip = JSON.parse(JSON.stringify(context)) as { planets?: string[] };
    if (!context.planets.some(item => item.includes('太阳') && item.includes('双子')) || parsedRoundTrip.planets?.some(item => item.includes('Gemini'))) {
      fail('追问上下文不是中文盘面');
    } else ok('追问上下文是中文结构');

    process.env.MINGGONGTU_AI_API_KEY = secret;
    let system = '';
    globalThis.fetch = (async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const raw = typeof init?.body === 'string' ? init.body : '';
      if (raw.includes(secret)) fail('占星请求体含密钥');
      try {
        const body = JSON.parse(raw) as { messages?: { role?: string; content?: string }[] };
        system = body.messages?.find(message => message.role === 'system')?.content ?? '';
      } catch {
        system = '';
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: '这张盘宜先看上升和太阳是否同一元素，再决定要不要同时开两条线。'.repeat(40) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;

    const turns: { role: 'user' | 'assistant'; content: string }[] = [];
    const ask = async (text: string) => {
      turns.push({ role: 'user', content: text });
      return readJson(await postInterpret({ school: 'astro', messages: turns, context }));
    };
    const round1 = await ask('上升和太阳的配置，工作上宜怎么看？');
    const reply1 = typeof round1.json?.reply === 'string' ? round1.json.reply : '';
    if (round1.status !== 200 || reply1.length <= 800 || !reply1.includes(AI_DISCLAIMER)) fail(`占星首轮不成功: ${round1.status} ${round1.json?.error ?? ''}`);
    else if (!system.includes('西洋占星') || !system.includes('太阳') || system.includes('不要写成星曜名词词典') || system.includes('这是一张八字盘')) {
      fail('占星提示串到了紫微或八字');
    } else {
      turns.push({ role: 'assistant', content: reply1 });
      ok(`占星首轮成功，回复 ${reply1.length} 字`);
    }
    const round2 = await ask('可以');
    if (round2.status !== 200 || round2.json?.error === AI_ERRORS.badRequest) fail(`占星第二轮被拒绝: ${round2.status} ${round2.json?.error ?? ''}`);
    else if (!system.includes('西洋占星') || system.includes('不要写成星曜名词词典')) fail('第二轮提示变了盘种');
    else ok('占星第二轮快捷追问不再格式错误');

    const tooLongAssistant = await readJson(await postInterpret({
      school: 'astro',
      messages: [
        { role: 'user', content: '看盘' },
        { role: 'assistant', content: '甲'.repeat(CHAT_TURN_LIMITS.assistant + 1) },
        { role: 'user', content: '继续' },
      ],
      context,
    }));
    if (tooLongAssistant.json?.error !== AI_ERRORS.badRequest) fail('超过助手上限的历史没有被拒绝');
    else ok('助手历史仍以 4000 字为上限，不是 800 字');

    const baziAsAstro = await readJson(await postInterpret({
      school: 'astro',
      messages: [{ role: 'user', content: '看看' }],
      context: { school: 'bazi', readingTarget: '八字盘' },
    }));
    if (baziAsAstro.json?.error !== AI_ERRORS.needAstro) fail('八字上下文被占星接口接受了');
    else ok('占星接口拒绝八字上下文');

    const astroAsBazi = await readJson(await postInterpret({
      school: 'bazi',
      messages: [{ role: 'user', content: '看看' }],
      context,
    }));
    if (astroAsBazi.json?.error !== AI_ERRORS.needBazi) fail('占星上下文被八字接口接受了');
    else ok('八字接口拒绝占星上下文');
  }

  const http = await readJson(await astroRoute(new Request('http://local/api/astro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sample()),
  })));
  const httpChart = http.json?.chart as { ascendant?: { text?: string } } | undefined;
  if (http.status !== 200 || httpChart?.ascendant?.text !== '上升 狮子 10°54′') fail(`接口没有返回样例上升: ${http.status}`);
  else ok('接口返回样例本命盘');

  const badHttp = await readJson(await astroRoute(new Request('http://local/api/astro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  })));
  if (badHttp.status !== 500 && badHttp.status !== 400) fail(`坏 JSON 状态异常: ${badHttp.status}`);
  else if (badHttp.text.includes('node_modules') || badHttp.text.includes('Error:')) fail('坏 JSON 泄露了堆栈');
  else ok('坏 JSON 不泄露堆栈');

  const clientFiles = [
    'components/ChartWorkspace.tsx',
    'components/AstroBoard.tsx',
    'components/AstroWheel.tsx',
    'components/AstroPlaceFields.tsx',
    'components/InsightChat.tsx',
    'components/InsightPanel.tsx',
    'lib/astro/request.ts',
  ];
  for (const file of clientFiles) {
    const src = readFileSync(file, 'utf8');
    if (/from ['"]caelus|caelus-birth|swisseph/.test(src)) fail(`${file} 引用了星历库`);
  }
  ok('浏览器组件不直接引用星历库');
  const panel = readFileSync('components/InsightPanel.tsx', 'utf8');
  if (panel.includes("school !== 'bazi' && hasReadableChart")) fail('占星会落到紫微固定说明');
  else if (!panel.includes("school === 'ziwei'") || !panel.includes("school === 'astro'")) fail('解读面板没有分开三种盘');
  else ok('占星不会显示紫微固定说明');

  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.MINGGONGTU_AI_API_KEY;
  else process.env.MINGGONGTU_AI_API_KEY = originalKey;

  if (failures) {
    console.error(`\n${failures} 项失败`);
    process.exit(1);
  }
  console.log('\n占星预览通过');
}

main().catch(err => {
  const raw = err instanceof Error ? err.message : 'unknown';
  console.error(`\n测试运行失败: ${raw.split(secret).join('[redacted]')}`);
  process.exit(1);
});
