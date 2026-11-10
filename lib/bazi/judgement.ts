import type { BaziElementView, BaziJudgement } from './types';

/**
 * 分组与 xuantian-bazi@0.2.0 的 analyzeFiveElementBalance 相同：
 * 助身是印（生日主的五行）和比劫（日主自己的五行），
 * 耗身是食伤、财、官杀。
 * 这是扶抑，不是调候，也不是格局取用。
 */
const GENERATES: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CONTROLS: Record<string, string> = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };

export interface JudgementSource {
  dayMaster: string;
  element: string;
  label: string;
  season: string;
  root: string;
  support: string;
  seasonNote: string;
  rootNote: string;
  supportNote: string;
  useful: string[];
  unfavorable: string[];
  usefulNote: string;
  caution: string;
  pattern: string;
  scores: BaziElementView[];
}

export function supportGroups(element: string): { support: string[]; oppose: string[] } | null {
  const resource = Object.entries(GENERATES).find(([, child]) => child === element)?.[0];
  const output = GENERATES[element];
  const wealth = CONTROLS[element];
  const officer = Object.entries(CONTROLS).find(([, target]) => target === element)?.[0];
  if (!resource || !output || !wealth || !officer) return null;
  return { support: [resource, element], oppose: [output, wealth, officer] };
}

export function buildJudgement(source: JudgementSource): BaziJudgement {
  const special = /从|专旺/.test(source.pattern);
  const base: BaziJudgement = {
    status: source.label ? 'known' : 'unknown',
    label: source.label,
    dayMaster: source.dayMaster,
    element: source.element,
    season: source.season,
    root: source.root,
    support: source.support,
    seasonNote: source.seasonNote,
    rootNote: source.rootNote,
    supportNote: source.supportNote,
    useful: source.useful,
    unfavorable: source.unfavorable,
    usefulNote: source.usefulNote,
    caution: source.caution,
    pattern: source.pattern,
    special,
    bar: null,
  };
  if (!source.label) return base;
  const groups = supportGroups(source.element);
  if (!groups) return base;
  const scoreOf = (name: string) => source.scores.find(item => item.element === name)?.score;
  if (groups.support.concat(groups.oppose).some(name => typeof scoreOf(name) !== 'number')) return base;
  const support = round3(groups.support.reduce((sum, name) => sum + (scoreOf(name) as number), 0));
  const oppose = round3(groups.oppose.reduce((sum, name) => sum + (scoreOf(name) as number), 0));
  const derived = support <= oppose ? '偏弱' : '偏旺';
  if (derived !== source.label) return base;
  const total = support + oppose;
  const supportPct = total ? Math.round(support / total * 100) : 50;
  return {
    ...base,
    bar: { support, oppose, supportPct, opposePct: 100 - supportPct },
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
