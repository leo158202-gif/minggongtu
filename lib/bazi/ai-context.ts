import type { BaziAiContext, BaziChartView } from './types';

export type { BaziAiContext } from './types';

export function buildBaziAiContext(chart: BaziChartView, decadeIndex: number, year: number | null): BaziAiContext {
  const decade = chart.decades[decadeIndex] ?? chart.decades.find(item => item.active) ?? chart.decades[0];
  const selectedYear = decade?.years.find(item => item.year === year) ?? decade?.years.find(item => item.active) ?? decade?.years[0];
  const decadeText = decade ? decadeTextOf(decade) : '库没有返回大运';
  const yearText = selectedYear ? `${selectedYear.year} ${selectedYear.ganZhi}` : '这一段没有列出流年';
  return {
    school: 'bazi',
    readingTarget: `八字盘 · ${chart.calendarLabel} · ${chart.sectLabel} · 大运 ${decadeText} · 流年 ${yearText}`,
    calendarLabel: chart.calendarLabel,
    sectLabel: chart.sectLabel,
    trueSolar: chart.trueSolar,
    correction: correctionText(chart),
    dayMaster: chart.dayMaster,
    dayMasterElement: chart.dayMasterElement,
    pillars: chart.pillars.map(pillar => ({
      label: pillar.label,
      ganZhi: pillar.ganZhi,
      naYin: pillar.naYin,
      wuXing: pillar.wuXing,
      mainStar: pillar.mainStar,
      cangGan: pillar.cangGanDetail.length
        ? pillar.cangGanDetail.map(item => `${item.gan}${item.shiShen ? `(${item.shiShen})` : ''}`).join('、')
        : pillar.cangGan.join('、'),
    })),
    fiveElements: chart.fiveElements.map(item => item.score === null ? item.element : `${item.element}${item.score}`).join('、'),
    decades: chart.decades.map(decadeTextOf),
    selectedDecade: decadeText,
    selectedYear: yearText,
  };
}

export function buildBaziSystemPrompt(context: BaziAiContext): string {
  return [
    '你是命宫图里的八字对话助手。这是一张八字盘，不是紫微斗数命盘。',
    '不要改用十二宫、主星亮度或四化来回答，也不要把这张盘说成紫微盘。',
    '下面 JSON 是这一次提问时的四柱、藏干、十神、五行、纳音，以及用户正在看的大运和流年。换盘后以这一份为准。',
    '回答要落到这个人可以怎么做、这步大运或这个流年宜动还是宜守，用具体建议和趋势用语。',
    '不要写成干支名词词典，不要逐条解释十神定义。',
    '只使用 JSON 里出现的柱、干支、十神、大运和流年，不要编造盘上没有的柱。',
    '不要做医疗诊断、用药建议、投资承诺或收益保证。',
    '如果对话里还没有助手回复，第一条回复必须包含这句原话：「仅供参考、非绝对预言」。这是免责，不是预言。',
    '之后的回复不必重复这句，除非用户问起准不准。',
    '八字盘：',
    JSON.stringify(context),
  ].join('\n');
}

export function decadeTextOf(decade: { label: string; startAge: number | null; endAge: number | null; startYear: number | null; endYear: number | null }): string {
  const name = decade.label || '起运前';
  const age = decade.startAge !== null && decade.endAge !== null ? `${decade.startAge}–${decade.endAge}岁` : '';
  const span = decade.startYear !== null && decade.endYear !== null ? `${decade.startYear}-${decade.endYear}` : '';
  return [name, age, span].filter(Boolean).join(' ');
}

function correctionText(chart: BaziChartView): string {
  if (!chart.trueSolar) return '真太阳时关闭，八字直接用钟面时间，没有再做经度或夏令时修正。';
  const place = chart.assumedMeridian120 ? '未选出生地，经度按东经 120°' : `经度 ${chart.longitude}°`;
  const dst = chart.dstApplied ? `夏令时已修正 ${chart.dstMinutes ?? 0} 分钟` : '这次没有夏令时修正';
  return `真太阳时只由八字库计算一次。时区 Asia/Shanghai，${place}。${dst}。排盘时刻 ${chart.chartDatetime}。`;
}
