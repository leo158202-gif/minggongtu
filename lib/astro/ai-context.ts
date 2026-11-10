import type { AstroAiContext, AstroChartView } from './types';

export type { AstroAiContext } from './types';

export function buildAstroAiContext(chart: AstroChartView, includeTransits = false): AstroAiContext {
  const transitLines = includeTransits && chart.transits
    ? [`行运时刻 ${chart.transits.utcText}`, ...chart.transits.bodies.map(item => item.text), ...chart.transits.aspects.map(item => item.text)]
    : ['未打开行运，当前只看本命。'];
  return {
    school: 'astro',
    readingTarget: `西洋占星本命盘 · ${chart.ascendant.text} · ${chart.houseSystemLabel}宫位`,
    timeNote: chart.timeNote,
    calendarNote: chart.calendarNote,
    placeText: `${chart.placeText} · ${chart.zone} · ${chart.offsetLabel}`,
    houseSystem: chart.polarFallback
      ? `请求${chart.requestedHouseSystemLabel}，这个纬度不可用，实际是${chart.houseSystemLabel}`
      : chart.houseSystemLabel,
    polarFallback: chart.polarFallback ? '高纬宫位已改用实际宫位制' : '宫位制按请求使用',
    ascendant: chart.ascendant.text,
    midheaven: chart.midheaven.text,
    descendant: chart.descendant.text,
    imumCoeli: chart.imumCoeli.text,
    planets: chart.planets.map(item => item.retrograde ? `${item.text} 庙旺：${item.dignities}` : `${item.text} 庙旺：${item.dignities}`),
    cusps: chart.cusps.map(item => item.text),
    aspects: chart.aspects.map(item => item.text),
    transits: transitLines,
    warnings: [...chart.warnings, ...chart.unavailable],
    limits: `合盘未做。行运是 ${chart.transits?.utcText ?? '缺省'} 的一张快照，不是连续推运。度数显示到角分。计算来自 Caelus ${chart.engineVersion}，本站没有独立复算精度。盘面没有附带批文。`,
  };
}

export function buildAstroSystemPrompt(context: AstroAiContext): string {
  return [
    '你是命宫图里的西洋占星对话助手。这是一张本命星盘预览。',
    '不要把这张盘说成紫微斗数或八字，也不要使用紫微十二宫、主星亮度、四化、干支或十神。',
    '下面 JSON 是计算库给出的结构：上升、天顶、行星落座落宫、逆行、庙旺标记和主要相位。',
    '若 transits 写着未打开行运，当前只看本命，不要按行运解读。用户打开行运后，才使用那一行运快照。',
    '度数只到角分。不要把容许度或位置说得比 JSON 更细，也不要改写成另一套宫位制。',
    '只使用 JSON 里出现的行星、星座、宫位和相位。没有列出的相位不要补充。',
    '外行星、凯龙和交点的庙旺若是破折号，表示没有古典庙旺，不要把它解释成吉或凶。',
    '回答用中文短段，每段一个意思，落到这个人可以怎么看这份配置。',
    '这是结构说明，不是预言，也不要写成星座百科。',
    '不要做医疗诊断、用药建议、投资承诺或收益保证。',
    '如果对话里还没有助手回复，第一条回复必须包含这句原话：「仅供参考、非绝对预言」。',
    '之后的回复不必重复这句，除非用户问起准不准。',
    '星盘：',
    JSON.stringify(context),
  ].join('\n');
}
