/**
 * 命盘页 AI 追问用的盘面上下文。
 * 只整理本命宫位主星、亮度、四化，以及当前大限 / 流年层和点中的宫。
 * 不带姓名、出生地和密钥。排盘算法不在这里。
 */
import type { Palace, SiHua, Star, ZiweiChart } from './types';
import { BRANCHES, STEMS } from './constants';
import { getLiuNianSiHua, getSiHuaByStem, getYearBranchIndex } from './sihua';

export type AiView = 'mingpan' | 'daxian' | 'liunian';

export interface AiChartContextInput {
  view: AiView;
  liunianYear: number;
  selectedPalace?: Palace | null;
}

export interface AiStarFact {
  name: string;
  brightness: string | null;
  siHua: SiHua | null;
}

export interface AiPalaceFact {
  name: string;
  branch: string;
  stem: string;
  majors: AiStarFact[];
  borrowedMajorNames: string[];
  brief: string;
}

export interface AiTransformFact {
  siHua: SiHua;
  star: string;
  palace: string | null;
}

export interface AiChartContext {
  /** 用户此刻打开的层：本命 / 大限 / 流年 */
  view: AiView;
  viewLabel: '本命' | '大限' | '流年';
  /** 给人读的当前层，例如「大限 32–41岁 · 官禄」或「流年 2026」 */
  activeLayer: string;
  liunianYear: number;
  wuxingJuName: string;
  yinYangGender: string;
  currentAge: number | null;
  mingGongBranch: string;
  shenGongBranch: string;
  palaces: AiPalaceFact[];
  natalSihua: { star: string; siHua: SiHua; palace: string }[];
  currentDaXian: null | {
    startAge: number;
    endAge: number;
    palaceName: string;
    stem: string;
    transforms: AiTransformFact[];
  };
  liunian: {
    year: number;
    stem: string;
    branch: string;
    landedPalace: string | null;
    transforms: AiTransformFact[];
  };
  selectedPalace: null | {
    name: string;
    branch: string;
    majors: AiStarFact[];
    brief: string;
  };
}

const SIHUA_ORDER: SiHua[] = ['禄', '权', '科', '忌'];

const VIEW_LABEL: Record<AiView, AiChartContext['viewLabel']> = {
  mingpan: '本命',
  daxian: '大限',
  liunian: '流年',
};

export function buildAiChartContext(chart: ZiweiChart, input: AiChartContextInput): AiChartContext {
  const year = normalizeYear(input.liunianYear);
  const palaces = [...chart.palaces].sort((a, b) => a.branch - b.branch).map(palaceFact);
  const natalSihua = collectNatalSihua(chart);
  const currentDaXian = daXianFact(chart);
  const liunian = liunianFact(chart, year);
  const selected = selectedFact(chart, input.selectedPalace);
  const view = input.view;

  return {
    view,
    viewLabel: VIEW_LABEL[view],
    activeLayer: activeLayer(view, year, currentDaXian),
    liunianYear: year,
    wuxingJuName: chart.wuxingJuName || '',
    yinYangGender: chart.yinYangGender || '',
    currentAge: Number.isFinite(chart.currentAge) ? chart.currentAge : null,
    mingGongBranch: BRANCHES[chart.mingGongBranch] ?? '',
    shenGongBranch: BRANCHES[chart.shenGongBranch] ?? '',
    palaces,
    natalSihua,
    currentDaXian,
    liunian,
    selectedPalace: selected,
  };
}

function activeLayer(
  view: AiView,
  year: number,
  currentDaXian: AiChartContext['currentDaXian'],
): string {
  if (view === 'daxian') {
    if (!currentDaXian) return '大限（当前年龄没有对上的大限）';
    return `大限 ${currentDaXian.startAge}–${currentDaXian.endAge}岁 · ${currentDaXian.palaceName}`;
  }
  if (view === 'liunian') return `流年 ${year}`;
  return '本命';
}

function palaceFact(palace: Palace): AiPalaceFact {
  const majors = palace.stars.filter(star => star.type === 'major').map(starFact);
  const borrowedMajorNames = palace.isEmpty ? (palace.borrowedStars ?? []).slice(0, 8) : [];
  const fact: AiPalaceFact = {
    name: palace.name,
    branch: BRANCHES[palace.branch] ?? '',
    stem: STEMS[palace.stem] ?? '',
    majors,
    borrowedMajorNames,
    brief: '',
  };
  fact.brief = palaceBrief(fact);
  return fact;
}

function palaceBrief(palace: Pick<AiPalaceFact, 'name' | 'branch' | 'majors' | 'borrowedMajorNames'>): string {
  if (palace.majors.length === 0) {
    const borrowed = palace.borrowedMajorNames.length
      ? `无主星，借${palace.borrowedMajorNames.join('、')}`
      : '无主星';
    return `${palace.name}（${palace.branch}）：${borrowed}`;
  }
  const stars = palace.majors.map(star => {
    const tags = [star.brightness, star.siHua ? `化${star.siHua}` : null].filter((tag): tag is string => !!tag);
    return tags.length ? `${star.name}（${tags.join('·')}）` : star.name;
  }).join('、');
  return `${palace.name}（${palace.branch}）：${stars}`;
}

function starFact(star: Star): AiStarFact {
  return {
    name: star.name,
    brightness: star.brightnessRaw ?? null,
    siHua: star.siHua ?? null,
  };
}

function selectedFact(chart: ZiweiChart, picked?: Palace | null): AiChartContext['selectedPalace'] {
  if (!picked) return null;
  const live = chart.palaces.find(palace => palace.branch === picked.branch);
  if (!live) return null;
  const fact = palaceFact(live);
  return {
    name: fact.name,
    branch: fact.branch,
    majors: fact.majors,
    brief: fact.brief,
  };
}

function collectNatalSihua(chart: ZiweiChart): AiChartContext['natalSihua'] {
  const found: AiChartContext['natalSihua'] = [];
  for (const palace of chart.palaces) {
    for (const star of palace.stars) {
      if (!star.siHua) continue;
      found.push({ star: star.name, siHua: star.siHua, palace: palace.name });
    }
  }
  found.sort((a, b) => SIHUA_ORDER.indexOf(a.siHua) - SIHUA_ORDER.indexOf(b.siHua));
  return found;
}

function daXianFact(chart: ZiweiChart): AiChartContext['currentDaXian'] {
  const index = chart.currentDaXianIndex;
  if (!Array.isArray(chart.daXians) || !Number.isInteger(index) || index < 0 || index >= chart.daXians.length) {
    return null;
  }
  const dx = chart.daXians[index];
  if (!dx) return null;
  const palace = chart.palaces.find(item => item.branch === dx.palaceBranch);
  const stem = palace ? (STEMS[palace.stem] ?? '') : '';
  const transforms = palace ? transformsFrom(chart, getSiHuaByStem(palace.stem)) : [];
  return {
    startAge: dx.startAge,
    endAge: dx.endAge,
    palaceName: dx.palaceName,
    stem,
    transforms,
  };
}

function liunianFact(chart: ZiweiChart, year: number): AiChartContext['liunian'] {
  const { stemName, transforms } = getLiuNianSiHua(year);
  const branchIndex = getYearBranchIndex(year);
  const landed = chart.palaces.find(palace => palace.branch === branchIndex);
  return {
    year,
    stem: stemName,
    branch: BRANCHES[branchIndex] ?? '',
    landedPalace: landed?.name ?? null,
    transforms: transformsFrom(chart, transforms),
  };
}

function transformsFrom(chart: ZiweiChart, transforms: Record<SiHua, string>): AiTransformFact[] {
  return SIHUA_ORDER.map(siHua => {
    const star = transforms[siHua] ?? '';
    const palace = star
      ? chart.palaces.find(item => item.stars.some(itemStar => itemStar.name === star))
      : undefined;
    return { siHua, star, palace: palace?.name ?? null };
  });
}

function normalizeYear(year: number): number {
  if (!Number.isFinite(year)) return new Date().getFullYear();
  return Math.trunc(year);
}
