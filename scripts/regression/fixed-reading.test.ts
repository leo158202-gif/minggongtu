/**
 * 固定话术解读：只引用当前命盘上的宫和星，并随本命 / 大限 / 流年层改口。
 * 跑: npx tsx scripts/regression/fixed-reading.test.ts
 */
import { readFileSync } from 'node:fs';
import { generateChart } from '../../lib/ziwei/algorithm';
import {
  answerQuickQuestion,
  buildChartReading,
  hasReadableChart,
} from '../../lib/ziwei/fixed-reading';
import type { BirthInfo } from '../../lib/ziwei/types';

let failures = 0;
const fail = (msg: string) => { console.error(`  ✗ ${msg}`); failures++; };
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

const MAJOR = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];

const birth: BirthInfo = { year: 1990, month: 8, day: 15, hour: 3, gender: 'female', name: '测试' };
const chart = generateChart(birth);
const year = 2026;

if (!hasReadableChart(chart)) fail('样例盘不可读');
else ok('样例盘可读');

if (hasReadableChart(null) || hasReadableChart(undefined)) fail('空盘被当成可读');
else ok('空盘不可读');

const natal = buildChartReading(chart, { view: 'mingpan', liunianYear: year });
const daxian = buildChartReading(chart, { view: 'daxian', liunianYear: year });
const liunian = buildChartReading(chart, { view: 'liunian', liunianYear: year });

const titles = natal.sections.map(s => s.title);
if (titles.join(',') !== '本命说明,流年怎么看,大限怎么看') fail(`栏目不对: ${titles.join(',')}`);
else ok('三栏标题齐全');

if (natal.layerLabel !== '本命' || !natal.layerHint.includes('本命')) fail(`本命层提示不对: ${natal.layerHint}`);
else ok('本命层有提示');

if (!daxian.layerHint.includes('大限') || daxian.activeSectionId !== 'daxian') fail('大限层没有跟着切');
else ok('切到大限时提示当前层');

if (!liunian.layerLabel.includes(String(year)) || !liunian.layerHint.includes('流年')) fail('流年层没有跟着年份');
else ok('切到流年时提示当前层和年份');

if (natal.layerHint === daxian.layerHint || daxian.layerHint === liunian.layerHint) {
  fail('三层提示没有区分开');
} else ok('三层提示互不相同');

const ming = chart.palaces.find(p => p.name === '命宫');
if (!ming) fail('没有命宫');
else {
  const majors = ming.stars.filter(s => s.type === 'major').map(s => s.name);
  const natalText = natal.sections.find(s => s.id === 'natal')!.paragraphs.join('\n');
  const mingLine = natalText.split('\n').find(line => line.startsWith('命宫（'));
  if (!mingLine) fail('本命说明没有命宫行');
  else if (majors.length === 0) {
    if (!mingLine.includes('没有主星')) fail(`空宫命宫没有说明借星: ${mingLine}`);
    else ok('空宫命宫按借对宫说明');
  } else {
    const missing = majors.filter(name => !mingLine.includes(name));
    const extras = MAJOR.filter(name => !majors.includes(name) && mingLine.includes(`${name}（`) || (!majors.includes(name) && mingLine.includes(`主星是${name}`)));
    if (missing.length) fail(`命宫行漏了主星 ${missing.join('、')}: ${mingLine}`);
    else if (mingLine.includes('没有主星')) fail('有主星却写成空宫');
    else ok(`命宫主星与盘一致: ${majors.join('、')}`);
    if (extras.length) fail(`命宫行写入了不在命宫的主星 ${extras.join('、')}`);
  }
  for (const palace of chart.palaces) {
    if (!natalText.includes(palace.name)) fail(`本命说明漏了宫名 ${palace.name}`);
  }
  if (failures === 0) ok('十二宫名都出现在本命说明里');
}

const dx = chart.daXians[chart.currentDaXianIndex];
const dxText = daxian.sections.find(s => s.id === 'daxian')!.paragraphs.join('\n');
if (!dx) fail('样例盘没有当前大限');
else if (!dxText.includes(dx.palaceName) || !dxText.includes(String(dx.startAge)) || !dxText.includes('大限怎么看')) {
  fail(`大限说明没有用当前大限: ${dx.palaceName} ${dx.startAge}`);
} else ok(`大限说明使用当前大限 ${dx.palaceName} ${dx.startAge}–${dx.endAge}`);

const lnText = liunian.sections.find(s => s.id === 'liunian')!.paragraphs.join('\n');
if (!lnText.includes('流年怎么看') || !lnText.includes(String(year)) || !lnText.includes('四化')) {
  fail('流年说明没有按所选年份写');
} else ok('流年说明按所选年份写四化');

const natalLn = natal.sections.find(s => s.id === 'liunian')!.paragraphs.join('\n');
if (!natalLn.includes('本命')) fail('停在本命层时，流年说明没有指出当前层');
else ok('停在本命层时，流年说明会指出还没切到流年');

const picked = chart.palaces.find(p => p.name === '夫妻')!;
const pickedAnswer = answerQuickQuestion(chart, { view: 'daxian', liunianYear: year, selectedPalace: picked }, 'palace');
const pickedText = pickedAnswer.join('\n');
if (!pickedText.includes('夫妻') || !pickedText.includes('大限')) fail('点宫回答没有同时写出宫名和当前层');
else ok('点中的宫回答带宫名和当前层');

const emptyPalace = answerQuickQuestion(chart, { view: 'mingpan', liunianYear: year }, 'palace');
if (!emptyPalace.join('\n').includes('还没有点中的宫')) fail('未点宫时没有空提示');
else ok('未点宫时有提示');

const guarded = ['components/InsightPanel.tsx', 'lib/ziwei/fixed-reading.ts', 'app/chart/page.tsx'];
for (const file of guarded) {
  const text = readFileSync(file, 'utf8');
  if (/fetch\s*\(|\/api\/interpret|openai|anthropic/i.test(text)) {
    fail(`${file} 出现外部解读接口`);
  }
}
ok('解读路径没有外部接口调用');

if (failures) {
  console.error(`\n${failures} 项失败`);
  process.exit(1);
}
console.log('\n固定话术解读通过');
