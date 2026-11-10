/**
 * 1988-07-21 04:15 广州诊断。不改排盘。
 * 用户已说明这组钟面是去掉夏令时后的标准北京时间（UTC+8）。
 * 现用产品路径仍把 Asia/Shanghai 的历史夏令时扣进真太阳时，这是待修行为，此文件只把它锁成观测。
 * 跑: npx tsx scripts/diagnosis/bazi-1988-semantics.test.ts
 */
import { calculateChart } from 'xuantian-bazi';
import { castBazi } from '../../lib/bazi/cast';

let failures = 0;
const fail = (msg: string) => { console.error(`  ✗ ${msg}`); failures++; };
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

const CONFIRMED = '戊辰 己未 丁丑 壬寅';
const DST_WALL = '戊辰 己未 丁丑 辛丑';
const GUANGZHOU_CENTER = 113.3;

function pillarsOf(raw: { normalizedChart: { year_pillar: string; month_pillar: string; day_pillar: string; hour_pillar: string } }): string {
  const chart = raw.normalizedChart;
  return [chart.year_pillar, chart.month_pillar, chart.day_pillar, chart.hour_pillar].join(' ');
}

function direct(zone: string, trueSolar: boolean, extra: { birthDate?: string; birthTime?: string; sect?: 1 | 2; longitude?: number; calendar?: 'solar' | 'lunar'; leapMonth?: boolean } = {}) {
  return calculateChart({
    gender: 'female',
    calendar: extra.calendar ?? 'solar',
    birthDate: extra.birthDate ?? '1988-07-21',
    birthTime: extra.birthTime ?? '04:15',
    sect: extra.sect ?? 2,
    longitude: extra.longitude ?? GUANGZHOU_CENTER,
    timeZone: zone,
    trueSolarTime: trueSolar,
    leapMonth: extra.leapMonth,
  });
}

const product = castBazi({
  gender: 'female',
  calendar: 'solar',
  birthDate: '1988-07-21',
  birthTime: '04:15',
  leapMonth: false,
  sect: 2,
  trueSolar: true,
  longitude: GUANGZHOU_CENTER,
});
const productPillars = product.pillars.map(item => item.ganZhi).join(' ');
const library = direct('Asia/Shanghai', true);
const libraryPillars = pillarsOf(library);
const trueSolar = library.timeCorrections?.true_solar as {
  correctionMinutes?: number;
  longitudeCorrectionMinutes?: number;
  equationOfTimeMinutes?: number;
  dstOffsetMinutes?: number;
  source?: string;
} | undefined;
const dst = library.timeCorrections?.dst as { dstApplied?: boolean; dstMinutes?: number } | undefined;

console.log('样例 1988-07-21 04:15 女 广州中心经度 113.3°（近似，不是医院）');
console.log(`产品四柱 ${productPillars} 排盘时刻 ${product.chartDatetime} 夏令时 ${product.dstMinutes} 分 真太阳时合计 ${product.trueSolarMinutes} 分`);
console.log(`库直调四柱 ${libraryPillars} 排盘时刻 ${library.chartDateTime} 来源 ${trueSolar?.source}`);
console.log(`经度差 ${trueSolar?.longitudeCorrectionMinutes} 分 均时差 ${trueSolar?.equationOfTimeMinutes} 分 DST偏移 ${trueSolar?.dstOffsetMinutes} 分`);

if (productPillars !== DST_WALL || product.chartDatetime !== '1988-07-21T02:41:51') {
  fail(`产品路径不再是已观测的错误结果 ${productPillars} ${product.chartDatetime}`);
} else if (library.chartDateTime !== product.chartDatetime || libraryPillars !== productPillars) {
  fail('封装又做了一次校正，和库直调不一致');
} else if (dst?.dstMinutes !== -60 || trueSolar?.dstOffsetMinutes !== 60) {
  fail(`夏令时不是一次 -60 分：dst=${dst?.dstMinutes} offset=${trueSolar?.dstOffsetMinutes}`);
} else if ((trueSolar?.correctionMinutes ?? 0) > -80) {
  fail('产品合计校正没有包含那 60 分');
} else ok('产品只调用库一次：Asia/Shanghai 真太阳时内含历史夏令时 -60 分，得到辛丑、02:41:51');

const standard = direct('Etc/GMT-8', true);
const standardSolar = standard.timeCorrections?.true_solar as {
  correctionMinutes?: number;
  longitudeCorrectionMinutes?: number;
  equationOfTimeMinutes?: number;
  dstOffsetMinutes?: number;
} | undefined;
const standardPillars = pillarsOf(standard);
console.log(`UTC+8 固定时区四柱 ${standardPillars} 排盘时刻 ${standard.chartDateTime}`);
console.log(`经度差 ${standardSolar?.longitudeCorrectionMinutes} 分 均时差 ${standardSolar?.equationOfTimeMinutes} 分 合计 ${standardSolar?.correctionMinutes} 分`);
if (standardPillars !== CONFIRMED || standard.chartDateTime !== '1988-07-21T03:41:51') {
  fail(`标准北京时间加一次真太阳时没有得到用户确认的盘：${standardPillars} ${standard.chartDateTime}`);
} else if (standardSolar?.dstOffsetMinutes) {
  fail('UTC+8 固定时区仍扣了夏令时');
} else if (Math.abs((standardSolar?.longitudeCorrectionMinutes ?? 0) - (4 * (GUANGZHOU_CENTER - 120))) > 0.05) {
  fail(`经度差不是 4×(113.3-120)：${standardSolar?.longitudeCorrectionMinutes}`);
} else if (Math.abs((standardSolar?.correctionMinutes ?? 0) - ((standardSolar?.longitudeCorrectionMinutes ?? 0) + (standardSolar?.equationOfTimeMinutes ?? 0))) > 0.01) {
  fail('真太阳时合计不是经度差加均时差');
} else ok('同一库、不扣夏令时：经度差 -26.8 分 + 均时差，排盘时刻 03:41:51，四柱戊辰 己未 丁丑 壬寅');

const wall = direct('Etc/GMT-9', true);
console.log(`历史夏令钟面 UTC+9（不是本样例） ${pillarsOf(wall)} ${wall.chartDateTime}`);
if (pillarsOf(wall) !== DST_WALL || wall.chartDateTime !== '1988-07-21T02:41:51') {
  fail('UTC+9 对照模式没有落到辛丑');
} else ok('历史夏令钟面保留为另一模式：UTC+9 得到辛丑、02:41:51');

const male = castBazi({
  gender: 'male', calendar: 'solar', birthDate: '1988-07-21', birthTime: '04:15',
  leapMonth: false, sect: 2, trueSolar: true, longitude: GUANGZHOU_CENTER,
});
if (male.pillars.map(item => item.ganZhi).join(' ') !== productPillars) fail('性别改变了四柱');
else ok('性别不改变这四柱；日主称谓差异不是时柱错误');

const late = direct('Etc/GMT-8', false, { birthDate: '1990-08-15', birthTime: '23:30', sect: 2, longitude: 120 });
const early = direct('Etc/GMT-8', false, { birthDate: '1990-08-15', birthTime: '23:30', sect: 1, longitude: 120 });
const zero = direct('Etc/GMT-8', false, { birthDate: '1990-08-16', birthTime: '00:00', sect: 2, longitude: 120 });
console.log(`晚子时 ${pillarsOf(late)}`);
console.log(`23点换日 ${pillarsOf(early)}`);
console.log(`次日0点 ${pillarsOf(zero)}`);
if (pillarsOf(late).split(' ')[2] === pillarsOf(early).split(' ')[2]) fail('两种子时没有分开日柱');
else if (pillarsOf(zero).split(' ')[2] !== pillarsOf(early).split(' ')[2]) fail('0点没有接上换日');
else ok('23:00 两派和次日 0 点仍然可分开');

const beforeTerm = direct('Etc/GMT-8', false, { birthDate: '2024-02-04', birthTime: '16:00', longitude: 120 });
const afterTerm = direct('Etc/GMT-8', false, { birthDate: '2024-02-04', birthTime: '17:00', longitude: 120 });
console.log(`现用库 2024-02-04 16:00 ${pillarsOf(beforeTerm)}`);
console.log(`现用库 2024-02-04 17:00 ${pillarsOf(afterTerm)}`);
console.log('sxtwl 立春儒略日换算为北京时间 2024-02-05 00:26:53，与上面 16/17 点的年柱切换不是同一时刻');
if (pillarsOf(beforeTerm).slice(0, 2) === pillarsOf(afterTerm).slice(0, 2)) fail('现用库在该时刻没有切换年柱');
else ok('现用库年柱在 2024-02-04 16:00 与 17:00 之间切换；这与寿星历立春 02-05 00:26 不一致，不能互相当精度证明');

const cross = direct('Etc/GMT-8', true, { birthDate: '2000-01-15', birthTime: '00:20', longitude: 75 });
console.log(`东经75° 2000-01-15 00:20 真太阳时 ${cross.chartDateTime} ${pillarsOf(cross)}`);
if (!cross.chartDateTime.startsWith('2000-01-14T21:11:04')) fail(`真太阳时跨日结果变了 ${cross.chartDateTime}`);
else ok('真太阳时跨日仍是一次校正：2000-01-14T21:11:04');

const lunarMonth = castBazi({
  gender: 'female', calendar: 'lunar', birthDate: '2023-02-20', birthTime: '08:00',
  leapMonth: false, sect: 2, trueSolar: false,
});
const leapMonth = castBazi({
  gender: 'female', calendar: 'lunar', birthDate: '2023-02-20', birthTime: '08:00',
  leapMonth: true, sect: 2, trueSolar: false,
});
console.log(`农历 2023-02-20 ${lunarMonth.solarDatetime} ${lunarMonth.pillars.map(item => item.ganZhi).join(' ')}`);
console.log(`闰月 ${leapMonth.solarDatetime} ${leapMonth.pillars.map(item => item.ganZhi).join(' ')}`);
if (lunarMonth.solarDatetime === leapMonth.solarDatetime) fail('闰月和常月排成了同一天');
else ok('农历闰月仍换成另一个公历日');

if (failures) {
  console.error(`\n${failures} 项失败`);
  process.exit(1);
}
console.log('\n1988 输入语义诊断通过');
