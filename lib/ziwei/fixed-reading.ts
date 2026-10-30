/**
 * 命盘页「解读」的固定话术。
 * 只读当前命盘上的宫位、主星、亮度和四化，以及时间轴上选中的大限 / 流年。
 * 不请求网络，也不调用任何解读接口。
 */
import type { Palace, SiHua, Star, ZiweiChart } from './types';
import { BRANCHES, STAR_DESCRIPTIONS, STEMS } from './constants';
import { getLiuNianSiHua, getSiHuaByStem, getYearBranchIndex } from './sihua';

export type ReadingView = 'mingpan' | 'daxian' | 'liunian';

export interface ReadingContext {
  view: ReadingView;
  liunianYear: number;
  selectedPalace?: Palace | null;
}

export interface ReadingSection {
  id: 'natal' | 'liunian' | 'daxian';
  title: string;
  paragraphs: string[];
}

export interface QuickQuestion {
  id: string;
  label: string;
}

export interface ChartReading {
  layerLabel: string;
  layerHint: string;
  /** 与时间轴一致，用来高亮对应说明 */
  activeSectionId: ReadingSection['id'];
  sections: ReadingSection[];
  selectedParagraphs: string[] | null;
  questions: QuickQuestion[];
}

export const QUICK_QUESTIONS: QuickQuestion[] = [
  { id: 'natal', label: '本命说明' },
  { id: 'liunian', label: '流年怎么看' },
  { id: 'daxian', label: '大限怎么看' },
  { id: 'sihua', label: '生年四化落在哪' },
  { id: 'sanfang', label: '三方四正有哪些星' },
  { id: 'palace', label: '这一宫怎么看' },
];

/** iztro 中文盘的宫名。命宫保留「宫」字，交友宫写作仆役。 */
const PALACE_ORDER = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];

const PALACE_ROLE: Record<string, string> = {
  '命宫': '主管先天气质和一生的主轴。',
  '兄弟': '主管兄弟姐妹、同辈，也用来看合伙与同事。',
  '夫妻': '主管配偶气质和感情相处。',
  '子女': '主管子女缘分，也常借看晚辈、学生、下属。',
  '财帛': '主管赚钱的方式和钱怎么流动。',
  '疾厄': '主管身体的薄弱处。',
  '迁移': '主管出门、外地和外界给的机会，也是命宫的对外一面。',
  '仆役': '主管朋友、同事和贵人小人。盘面上这一宫写「仆役」。',
  '官禄': '主管事业、职位和社会角色。',
  '田宅': '主管住处、家庭和不动产，也是财库的一面。',
  '福德': '主管内心喜好和精神状态。',
  '父母': '主管父母长辈、文书契约，也可看上司一类的长辈关系。',
};

const SIHUA_ORDER: SiHua[] = ['禄', '权', '科', '忌'];

export function hasReadableChart(chart: ZiweiChart | null | undefined): chart is ZiweiChart {
  return !!chart && Array.isArray(chart.palaces) && chart.palaces.length > 0;
}

export function buildChartReading(chart: ZiweiChart, ctx: ReadingContext): ChartReading {
  const layer = layerCopy(chart, ctx);
  return {
    layerLabel: layer.label,
    layerHint: layer.hint,
    activeSectionId: layer.activeSectionId,
    sections: [
      { id: 'natal', title: '本命说明', paragraphs: natalParagraphs(chart, ctx) },
      { id: 'liunian', title: '流年怎么看', paragraphs: liunianParagraphs(chart, ctx) },
      { id: 'daxian', title: '大限怎么看', paragraphs: daxianParagraphs(chart, ctx) },
    ],
    selectedParagraphs: selectedParagraphs(chart, ctx),
    questions: QUICK_QUESTIONS,
  };
}

export function answerQuickQuestion(chart: ZiweiChart, ctx: ReadingContext, questionId: string): string[] {
  const layer = layerCopy(chart, ctx).hint;
  switch (questionId) {
    case 'natal':
      return [
        layer,
        ...natalSummary(chart),
        '十二宫逐宫对照在下方「本命说明」里，宫名和主星都取自当前这张盘。',
      ];
    case 'liunian':
      return liunianParagraphs(chart, ctx);
    case 'daxian':
      return daxianParagraphs(chart, ctx);
    case 'sihua':
      return [layer, natalSihuaSentence(chart)];
    case 'sanfang':
      return [layer, sanfangSentence(chart), '三方四正就是命宫，加上财帛、官禄、迁移。先读命宫主星，再用这三宫看钱、事业和外出是否接得住。'];
    case 'palace':
      return selectedParagraphs(chart, ctx) ?? [
        layer,
        '在左侧命盘上点一宫，这里会用那一宫的主星做说明。现在还没有点中的宫。',
      ];
    default:
      return [layer, '这一期只回答上面的快捷问题，答案按当前命盘填，没有自由追问。'];
  }
}

function layerCopy(chart: ZiweiChart, ctx: ReadingContext): { label: string; hint: string; activeSectionId: ReadingSection['id'] } {
  if (ctx.view === 'daxian') {
    const dx = currentDaXian(chart);
    if (!dx) {
      return {
        label: '大限',
        hint: '当前查看的是「大限」层。这张盘没有对上当前年龄的大限。',
        activeSectionId: 'daxian',
      };
    }
    return {
      label: `大限 ${dx.startAge}–${dx.endAge}岁 · ${dx.palaceName}`,
      hint: `当前查看的是「大限」层：${dx.startAge}–${dx.endAge}岁，走到${dx.palaceName}。星旁多出来的「限」是这一宫宫干的四化。`,
      activeSectionId: 'daxian',
    };
  }
  if (ctx.view === 'liunian') {
    const year = normalizeYear(ctx.liunianYear);
    return {
      label: `流年 ${year}`,
      hint: `当前查看的是「流年」层：${year}年。星旁多出来的「年」是这一年天干的四化。`,
      activeSectionId: 'liunian',
    };
  }
  return {
    label: '本命',
    hint: '当前查看的是「本命」层。星旁的禄权科忌是生年四化，十二宫和主星不随大限、流年改位置。',
    activeSectionId: 'natal',
  };
}

function natalParagraphs(chart: ZiweiChart, ctx: ReadingContext): string[] {
  return [
    layerCopy(chart, ctx).hint,
    '本命说明看的是出生时定下的十二宫。切换大限或流年，不会把星挪到别的宫；那两层只是在星旁再叠一套四化。',
    ...natalSummary(chart),
    '下面十二宫的宫名、主星、亮度和生年四化，都按当前这张盘填写。',
    ...orderedPalaces(chart).map(palace => palaceParagraph(chart, palace)),
  ];
}

function natalSummary(chart: ZiweiChart): string[] {
  const facts: string[] = [];
  const bits = [
    chart.wuxingJuName ? `这张盘是${chart.wuxingJuName}` : '',
    chart.yinYangGender ? chart.yinYangGender : '',
  ].filter(Boolean);
  const ming = mingPalace(chart);
  const mingBranch = BRANCHES[chart.mingGongBranch] ?? '';
  const shenBranch = BRANCHES[chart.shenGongBranch] ?? '';
  const place = [
    mingBranch ? `命宫在${mingBranch}` : '',
    shenBranch ? `身宫在${shenBranch}` : '',
    chart.mingZhu ? `命主${chart.mingZhu}` : '',
    chart.shenZhu ? `身主${chart.shenZhu}` : '',
  ].filter(Boolean);
  if (bits.length || place.length) {
    facts.push(`${[...bits, ...place].join('，')}。`);
  }
  if (ming) facts.push(palaceParagraph(chart, ming));
  facts.push(sanfangSentence(chart));
  facts.push(natalSihuaSentence(chart));
  return facts;
}

function liunianParagraphs(chart: ZiweiChart, ctx: ReadingContext): string[] {
  const year = normalizeYear(ctx.liunianYear);
  const { stemName, transforms } = getLiuNianSiHua(year);
  const branchIndex = getYearBranchIndex(year);
  const branchName = BRANCHES[branchIndex] ?? '';
  const landed = chart.palaces.find(p => p.branch === branchIndex);
  const lines = [
    layerCopy(chart, ctx).hint,
    '流年怎么看：流年是某一年的加减，不改本命十二宫。时间轴选「流年」，用年份两边的箭头选定年份。这一层按该年天干，把禄、权、科、忌叠在对应星旁边，标成「年」。生年四化还在，两套一起看。',
    '年支落在哪一宫，就先读那一宫主管的事。',
    `${year}年是${stemName}年，年支${branchName}，落在本命的「${landed?.name ?? '未找到对应宫'}」。`,
    `这一年的四化：${formatTransforms(chart, transforms)}`,
  ];
  if (ctx.view !== 'liunian') {
    lines.push(`时间轴现在停在${ctx.view === 'daxian' ? '大限' : '本命'}。上面仍按已选的 ${year} 年说明；切到「流年」后，这组四化会标在星旁。`);
  }
  return lines;
}

function daxianParagraphs(chart: ZiweiChart, ctx: ReadingContext): string[] {
  const lines = [
    layerCopy(chart, ctx).hint,
    '大限怎么看：大限十年换一宫。先看当前年龄落在哪一段、那一段的宫叫什么、宫里主星是什么，这十年就读这一宫主管的事。时间轴选「大限」后，按这一宫的天干再叠一套四化，标成「限」。',
  ];
  const ageText = Number.isFinite(chart.currentAge) ? `现在虚岁 ${chart.currentAge}。` : '';
  const dx = currentDaXian(chart);
  if (!dx) {
    const first = chart.daXians?.[0];
    lines.push(
      `${ageText}这张盘没有对上当前年龄的大限。${first ? `列表里最早一段是 ${first.startAge}–${first.endAge} 岁的${first.palaceName}。` : '盘上也没有大限列表。'}看大限时仍然是：找到那段年龄对应的宫，读该宫主星，再在「大限」层看宫干四化。`,
    );
    return lines;
  }
  const palace = chart.palaces.find(p => p.branch === dx.palaceBranch);
  lines.push(`${ageText}当前大限是 ${dx.startAge}–${dx.endAge} 岁，走到「${dx.palaceName}」。`);
  if (palace) {
    lines.push(palaceParagraph(chart, palace));
    const stemName = STEMS[palace.stem];
    if (stemName) {
      lines.push(`这一宫天干是${stemName}。切到「大限」时叠上的限四化：${formatTransforms(chart, getSiHuaByStem(palace.stem))}`);
    } else {
      lines.push('这一宫的天干读不出来，所以这里不列大限四化。');
    }
  } else {
    lines.push(`大限写明走到「${dx.palaceName}」，但十二宫里没有找到对应宫位。`);
  }
  if (ctx.view !== 'daxian') {
    lines.push(`时间轴现在停在${ctx.view === 'liunian' ? '流年' : '本命'}。上面这段仍是当前年龄所在的大限；切到「大限」后，限四化会标在星旁。`);
  }
  return lines;
}

function selectedParagraphs(chart: ZiweiChart, ctx: ReadingContext): string[] | null {
  const picked = ctx.selectedPalace;
  if (!picked) return null;
  const live = chart.palaces.find(p => p.branch === picked.branch);
  if (!live) return null;
  return [
    `你点的是「${live.name}」。宫位和主星取自本命盘。${layerCopy(chart, ctx).hint}`,
    palaceParagraph(chart, live),
  ];
}

function palaceParagraph(chart: ZiweiChart, palace: Palace): string {
  const branch = BRANCHES[palace.branch] ?? '';
  const role = PALACE_ROLE[palace.name] ?? '先看落在这一宫的主星。';
  const shen = palace.branch === chart.shenGongBranch ? '这里同时是身宫。' : '';
  const extras = palace.stars.filter(s => s.type !== 'major').map(s => s.name);
  const extraText = extras.length
    ? `同宫还有${extras.slice(0, 6).join('、')}${extras.length > 6 ? '等' : ''}，这里不另作断语。`
    : '';
  return `${palace.name}（${branch}）：${role}${shen}${describeMajors(chart, palace)}${extraText}`;
}

function describeMajors(chart: ZiweiChart, palace: Palace): string {
  const majors = majorStars(palace);
  if (majors.length > 0) {
    return `主星是${majors.map(starGloss).join('')}`;
  }
  const borrowed = borrowedMajors(chart, palace);
  if (borrowed.length > 0) {
    const from = palace.borrowedFromName
      ?? chart.palaces.find(p => p.branch === palace.oppositeBranch)?.name
      ?? '对宫';
    return `没有主星，借对宫「${from}」的${borrowed.map(s => s.name).join('、')}来看。${borrowed.map(starGloss).join('')}`;
  }
  return '没有主星，对宫也没有可借的主星。这一宫先按它主管的事来看。';
}

function starGloss(star: Star): string {
  const tags: string[] = [];
  if (star.brightnessRaw) tags.push(star.brightnessRaw);
  if (star.siHua) tags.push(`化${star.siHua}`);
  const title = tags.length ? `${star.name}（${tags.join('·')}）` : star.name;
  const desc = STAR_DESCRIPTIONS[star.name];
  if (!desc) return `${title}。`;
  return `${title}：${desc.keywords.split('·').join('、')}。性质${desc.nature}，五行属${desc.element}。`;
}

function sanfangSentence(chart: ZiweiChart): string {
  const parts = ['财帛', '官禄', '迁移'].map(name => {
    const palace = chart.palaces.find(p => p.name === name);
    if (!palace) return `${name}不在这张盘上`;
    const majors = majorStars(palace);
    if (majors.length > 0) return `${palace.name}是${majors.map(s => s.name).join('、')}`;
    const borrowed = borrowedMajors(chart, palace);
    if (borrowed.length > 0) {
      const from = palace.borrowedFromName ?? '对宫';
      return `${palace.name}无主星，借${from}的${borrowed.map(s => s.name).join('、')}`;
    }
    return `${palace.name}无主星`;
  });
  return `三方四正和命宫一起看：${parts.join('；')}。`;
}

function natalSihuaSentence(chart: ZiweiChart): string {
  const found: { siHua: SiHua; name: string; palace: string }[] = [];
  for (const palace of chart.palaces) {
    for (const star of palace.stars) {
      if (star.siHua) found.push({ siHua: star.siHua, name: star.name, palace: palace.name });
    }
  }
  found.sort((a, b) => SIHUA_ORDER.indexOf(a.siHua) - SIHUA_ORDER.indexOf(b.siHua));
  if (found.length === 0) return '这张盘上没有标出生年四化。';
  const body = found.map(item => `${item.name}化${item.siHua}在${item.palace}`).join('，');
  return `生年四化印在星上：${body}。禄是资源顺着来，权是要自己做主，科是名声文书，忌是容易卡住、要当成功课的那一项。`;
}

function formatTransforms(chart: ZiweiChart, transforms: Record<SiHua, string>): string {
  return SIHUA_ORDER.map(key => {
    const starName = transforms[key];
    if (!starName) return `化${key}没有对应星`;
    const hit = locateStar(chart, starName);
    return hit ? `${starName}化${key}在${hit.name}` : `${starName}化${key}（盘上没找到这颗星）`;
  }).join('，') + '。';
}

function locateStar(chart: ZiweiChart, starName: string): Palace | null {
  return chart.palaces.find(p => p.stars.some(s => s.name === starName)) ?? null;
}

function majorStars(palace: Palace): Star[] {
  return palace.stars.filter(s => s.type === 'major');
}

function borrowedMajors(chart: ZiweiChart, palace: Palace): Star[] {
  const fromBranch = palace.borrowedFromBranch ?? palace.oppositeBranch;
  if (fromBranch === undefined) {
    const opposite = chart.palaces.find(p => p.branch === (palace.branch + 6) % 12);
    return opposite ? majorStars(opposite) : [];
  }
  const opposite = chart.palaces.find(p => p.branch === fromBranch);
  return opposite ? majorStars(opposite) : [];
}

function orderedPalaces(chart: ZiweiChart): Palace[] {
  const byName = new Map(chart.palaces.map(p => [p.name, p]));
  const ordered = PALACE_ORDER.map(name => byName.get(name)).filter((p): p is Palace => !!p);
  if (ordered.length === chart.palaces.length) return ordered;
  return [...chart.palaces].sort((a, b) => a.branch - b.branch);
}

function mingPalace(chart: ZiweiChart): Palace | undefined {
  return chart.palaces.find(p => p.isMingGong)
    ?? chart.palaces.find(p => p.branch === chart.mingGongBranch)
    ?? chart.palaces.find(p => p.name === '命宫');
}

function currentDaXian(chart: ZiweiChart) {
  const index = chart.currentDaXianIndex;
  if (!Array.isArray(chart.daXians) || !Number.isInteger(index) || index < 0 || index >= chart.daXians.length) {
    return null;
  }
  return chart.daXians[index] ?? null;
}

function normalizeYear(year: number): number {
  if (!Number.isFinite(year)) return new Date().getFullYear();
  return Math.trunc(year);
}
