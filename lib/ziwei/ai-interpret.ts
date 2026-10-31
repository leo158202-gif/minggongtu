/**
 * 命盘 AI 追问的服务端组装。
 * 密钥只从环境变量读取，不进入提示词、响应或日志。
 */
import type { SiHua } from './types';
import type { AiChartContext, AiStarFact, AiTransformFact, AiView } from './ai-chart-context';

export const DEEPSEEK_CHAT_COMPLETIONS_URL = 'https://api.deepseek.com/chat/completions';
export const DEEPSEEK_MODEL = 'deepseek-chat';
export const AI_DISCLAIMER = '仅供参考、非绝对预言';

export const AI_ERRORS = {
  missingKey: '服务端未配置 AI 密钥，暂时不能回答。',
  badRequest: '请求格式不对，请重新发送。',
  needChart: '请先起盘后再提问。',
  upstream: '解读服务暂时连不上，请稍后再试。',
  busy: '解读服务正忙，请稍后再试。',
  emptyReply: '解读没有返回内容，请再试一次。',
  unexpected: '解读出错了，请稍后再试。',
} as const;

const VIEWS: AiView[] = ['mingpan', 'daxian', 'liunian'];
const VIEW_LABEL: Record<AiView, AiChartContext['viewLabel']> = {
  mingpan: '本命',
  daxian: '大限',
  liunian: '流年',
};
const SIHUA = new Set(['禄', '权', '科', '忌']);

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface PreparedInterpret {
  context: AiChartContext;
  turns: ChatTurn[];
}

/** 动态读取，避免构建时把未注入的密钥内联成空字符串。 */
export function readAiApiKey(env: Record<string, string | undefined> = process.env): string {
  const name = ['MINGGONGTU', 'AI', 'API', 'KEY'].join('_');
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export function buildSystemPrompt(context: AiChartContext): string {
  return [
    '你是命宫图里的紫微斗数对话助手。用户正在看一张已经排好的盘。',
    '下面 JSON 是这一次提问时的盘面：本命十二宫的主星、亮度、生年四化，当前大限，所选流年，以及用户点中的宫。',
    'activeLayer 是用户此刻打开的层。若它和更早的对话不一致，以这一份 JSON 为准。',
    '回答要落到这个人可以怎么做、这段时间宜进还是宜守，用具体建议和趋势用语。',
    '不要写成星曜名词词典，不要逐条解释庙、旺、得、利、平、陷的定义，也不要把十二宫职能表背一遍。',
    '只使用 JSON 里出现的宫名、主星、亮度和四化，不要编造盘上没有的星。',
    `如果对话里还没有助手回复，第一条回复必须包含这句原话：「${AI_DISCLAIMER}」。这是免责，不是预言。`,
    '之后的回复不必重复这句，除非用户问起准不准。',
    '语气示例（不要照抄内容）：这十年走到官禄，宜把一件已经上手的事做完，不宜同时开两条新线。流年忌如果落在财帛，花钱前先留出下半年的余量。',
    '盘面：',
    JSON.stringify(context),
  ].join('\n');
}

export function buildDeepSeekMessages(context: AiChartContext, turns: ChatTurn[]): { role: string; content: string }[] {
  return [
    { role: 'system', content: buildSystemPrompt(context) },
    ...turns.map(turn => ({ role: turn.role, content: turn.content })),
  ];
}

export function ensureFirstDisclaimer(reply: string, turns: ChatTurn[]): string {
  const priorAssistant = turns.slice(0, -1).some(turn => turn.role === 'assistant');
  if (priorAssistant || reply.includes(AI_DISCLAIMER)) return reply;
  return `${AI_DISCLAIMER}。\n${reply}`;
}

export async function completeInterpret(request: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const apiKey = readAiApiKey();
  if (!apiKey) return jsonError(AI_ERRORS.missingKey, 503);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(AI_ERRORS.badRequest, 400);
  }

  const prepared = prepareInterpret(payload);
  if ('error' in prepared) return jsonError(prepared.error, prepared.status);

  const messages = buildDeepSeekMessages(prepared.context, prepared.turns);
  let upstream: Response;
  try {
    upstream = await fetchImpl(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        temperature: 0.6,
        stream: false,
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return jsonError(AI_ERRORS.upstream, 502);
  }

  if (upstream.status === 429) return jsonError(AI_ERRORS.busy, 502);
  if (!upstream.ok) return jsonError(AI_ERRORS.upstream, 502);

  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return jsonError(AI_ERRORS.upstream, 502);
  }

  const reply = extractReply(data);
  if (!reply) return jsonError(AI_ERRORS.emptyReply, 502);
  const safeReply = redactSecret(ensureFirstDisclaimer(reply, prepared.turns), apiKey);
  return Response.json({ reply: safeReply });
}

function prepareInterpret(payload: unknown): PreparedInterpret | { error: string; status: number } {
  if (!isRecord(payload)) return { error: AI_ERRORS.badRequest, status: 400 };
  const context = parseAiChartContext(payload.context);
  if (!context) return { error: AI_ERRORS.needChart, status: 400 };
  const turns = parseChatTurns(payload.messages);
  if (!turns) return { error: AI_ERRORS.badRequest, status: 400 };
  return { context, turns };
}

export function parseChatTurns(value: unknown): ChatTurn[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 16) return null;
  const turns: ChatTurn[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    if (item.role !== 'user' && item.role !== 'assistant') return null;
    if (typeof item.content !== 'string') return null;
    const content = item.content.trim();
    if (!content || content.length > 800) return null;
    turns.push({ role: item.role, content });
  }
  if (turns[turns.length - 1]?.role !== 'user') return null;
  return turns;
}

export function parseAiChartContext(value: unknown): AiChartContext | null {
  if (!isRecord(value)) return null;
  if (!isView(value.view)) return null;
  const year = finiteInt(value.liunianYear, 1, 9999);
  if (year === null) return null;
  const palaces = parsePalaces(value.palaces);
  if (!palaces) return null;
  const currentAge = value.currentAge === null ? null : finiteInt(value.currentAge, 0, 150);
  if (value.currentAge !== null && currentAge === null) return null;

  const context: AiChartContext = {
    view: value.view,
    viewLabel: VIEW_LABEL[value.view],
    activeLayer: shortText(value.activeLayer, 80) ?? VIEW_LABEL[value.view],
    liunianYear: year,
    wuxingJuName: shortText(value.wuxingJuName, 20) ?? '',
    yinYangGender: shortText(value.yinYangGender, 8) ?? '',
    currentAge,
    mingGongBranch: shortText(value.mingGongBranch, 2) ?? '',
    shenGongBranch: shortText(value.shenGongBranch, 2) ?? '',
    palaces,
    natalSihua: parseNatalSihua(value.natalSihua),
    currentDaXian: parseDaXian(value.currentDaXian),
    liunian: parseLiunian(value.liunian, year),
    selectedPalace: parseSelected(value.selectedPalace),
  };

  if (JSON.stringify(context).length > 24_000) return null;
  return context;
}

function parsePalaces(value: unknown): AiChartContext['palaces'] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) return null;
  const palaces: AiChartContext['palaces'] = [];
  for (const item of value) {
    const palace = parsePalace(item);
    if (!palace) return null;
    palaces.push(palace);
  }
  return palaces;
}

function parsePalace(value: unknown): AiChartContext['palaces'][number] | null {
  if (!isRecord(value)) return null;
  const name = shortText(value.name, 8);
  if (!name) return null;
  const majors = parseStars(value.majors);
  if (!majors) return null;
  const borrowedMajorNames = parseNameList(value.borrowedMajorNames);
  return {
    name,
    branch: shortText(value.branch, 2) ?? '',
    stem: shortText(value.stem, 2) ?? '',
    majors,
    borrowedMajorNames,
    brief: shortText(value.brief, 160) ?? name,
  };
}

function parseSelected(value: unknown): AiChartContext['selectedPalace'] {
  if (value == null) return null;
  if (!isRecord(value)) return null;
  const name = shortText(value.name, 8);
  if (!name) return null;
  const majors = parseStars(value.majors) ?? [];
  return {
    name,
    branch: shortText(value.branch, 2) ?? '',
    majors,
    brief: shortText(value.brief, 160) ?? name,
  };
}

function parseStars(value: unknown): AiStarFact[] | null {
  if (!Array.isArray(value) || value.length > 8) return null;
  const stars: AiStarFact[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const name = shortText(item.name, 8);
    if (!name) return null;
    const siHua = readSiHua(item.siHua);
    stars.push({
      name,
      brightness: shortText(item.brightness, 2),
      siHua,
    });
  }
  return stars;
}

function parseNameList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => item.length > 0 && item.length <= 8)
    .slice(0, 8);
}

function parseNatalSihua(value: unknown): AiChartContext['natalSihua'] {
  if (!Array.isArray(value)) return [];
  const found: AiChartContext['natalSihua'] = [];
  for (const item of value.slice(0, 16)) {
    if (!isRecord(item)) continue;
    const star = shortText(item.star, 8);
    const palace = shortText(item.palace, 8);
    const siHua = readSiHua(item.siHua);
    if (!star || !palace || !siHua) continue;
    found.push({ star, palace, siHua });
  }
  return found;
}

function parseDaXian(value: unknown): AiChartContext['currentDaXian'] {
  if (value == null) return null;
  if (!isRecord(value)) return null;
  const startAge = finiteInt(value.startAge, 0, 150);
  const endAge = finiteInt(value.endAge, 0, 150);
  const palaceName = shortText(value.palaceName, 8);
  if (startAge === null || endAge === null || !palaceName) return null;
  return {
    startAge,
    endAge,
    palaceName,
    stem: shortText(value.stem, 2) ?? '',
    transforms: parseTransforms(value.transforms),
  };
}

function parseLiunian(value: unknown, fallbackYear: number): AiChartContext['liunian'] {
  const record = isRecord(value) ? value : {};
  const year = finiteInt(record.year, 1, 9999) ?? fallbackYear;
  return {
    year,
    stem: shortText(record.stem, 2) ?? '',
    branch: shortText(record.branch, 2) ?? '',
    landedPalace: record.landedPalace == null ? null : shortText(record.landedPalace, 8),
    transforms: parseTransforms(record.transforms),
  };
}

function parseTransforms(value: unknown): AiTransformFact[] {
  if (!Array.isArray(value)) return [];
  const transforms: AiTransformFact[] = [];
  for (const item of value.slice(0, 4)) {
    if (!isRecord(item)) continue;
    const siHua = readSiHua(item.siHua);
    if (!siHua) continue;
    transforms.push({
      siHua,
      star: shortText(item.star, 8) ?? '',
      palace: item.palace == null ? null : shortText(item.palace, 8),
    });
  }
  return transforms;
}

function extractReply(data: unknown): string {
  if (!isRecord(data) || !Array.isArray(data.choices) || !isRecord(data.choices[0])) return '';
  const message = data.choices[0].message;
  if (!isRecord(message) || typeof message.content !== 'string') return '';
  return message.content.trim().slice(0, 4000);
}

function redactSecret(text: string, secret: string): string {
  if (!secret || !text.includes(secret)) return text;
  return text.split(secret).join('');
}

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

function readSiHua(value: unknown): SiHua | null {
  if (typeof value !== 'string' || !SIHUA.has(value)) return null;
  return value as SiHua;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isView(value: unknown): value is AiView {
  return typeof value === 'string' && (VIEWS as string[]).includes(value);
}

function shortText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > max) return null;
  return text;
}

function finiteInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const int = Math.trunc(value);
  if (int < min || int > max) return null;
  return int;
}
