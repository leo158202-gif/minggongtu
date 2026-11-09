/**
 * 八字接入：必须调用 sfwal/xuantian-bazi，并用 lunar-javascript 与公历规则做独立对照。
 * lunar-javascript 不是 xuantian 四柱的封装（四柱走 tyme4ts），大运顺逆另用干支序数核对。
 * 跑: npx tsx scripts/regression/bazi-xuantian.test.ts
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { castBazi } from '../../lib/bazi/cast';
import { calculateChart } from 'xuantian-bazi';

const require = createRequire(import.meta.url);
const { Solar, LunarYear } = require('lunar-javascript') as {
  Solar: {
    fromYmd(year: number, month: number, day: number): { getLunar(): { getJieQiTable(): Record<string, { getHour(): number; getMinute(): number }> } };
    fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): {
      getLunar(): { getEightChar(): { setSect(sect: number): void; getYear(): string; getMonth(): string; getDay(): string; getTime(): string } };
    };
  };
  LunarYear: { fromYear(year: number): { getMonths(): Array<{ getMonth(): number }> } };
};

let failures = 0;
const fail = (msg: string) => { console.error(`  ✗ ${msg}`); failures++; };
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

const GAN = '甲乙丙丁戊己庚辛壬癸';
const ZHI = '子丑寅卯辰巳午未申酉戌亥';

function stepGanZhi(ganZhi: string, step: number): string {
  const gan = GAN.indexOf(ganZhi[0]);
  const zhi = ZHI.indexOf(ganZhi[1]);
  return GAN[(gan + step + 10) % 10] + ZHI[(zhi + step + 12) % 12];
}

function lunarPillars(year: number, month: number, day: number, hour: number, minute: number, sect: 1 | 2): string {
  const eight = Solar.fromYmdHms(year, month, day, hour, minute, 0).getLunar().getEightChar();
  eight.setSect(sect);
  return [eight.getYear(), eight.getMonth(), eight.getDay(), eight.getTime()].join(' ');
}

function xuantianPillars(birthDate: string, birthTime: string, sect: 1 | 2): string {
  const chart = castBazi({
    gender: 'male',
    calendar: 'solar',
    birthDate,
    birthTime,
    leapMonth: false,
    sect,
    trueSolar: false,
  });
  return chart.pillars.map(item => item.ganZhi).join(' ');
}

function zoneOffsetMinutes(timeZone: string, instant: Date): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant).map(part => [part.type, part.value]));
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const zoned = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  return Math.round((zoned - instant.getTime()) / 60000);
}

const pkg = JSON.parse(readFileSync('node_modules/xuantian-bazi/package.json', 'utf8')) as {
  version?: string;
  license?: string;
  repository?: { url?: string };
};
if (pkg.version !== '0.2.0' || pkg.license !== 'MIT' || !String(pkg.repository?.url || '').includes('sfwal/xuantian-bazi')) {
  fail(`安装的不是 sfwal/xuantian-bazi@0.2.0 MIT：${pkg.version} ${pkg.license} ${pkg.repository?.url}`);
} else ok('依赖是 sfwal/xuantian-bazi 0.2.0，MIT');

const base = xuantianPillars('1990-08-15', '08:00', 2);
if (base !== lunarPillars(1990, 8, 15, 8, 0, 2)) fail(`常规四柱和 lunar-javascript 不一致: ${base}`);
else ok(`常规四柱对照 lunar-javascript：${base}`);

const sample = castBazi({
  gender: 'female', calendar: 'solar', birthDate: '1990-08-15', birthTime: '08:00',
  leapMonth: false, sect: 2, trueSolar: false,
});
const yearPillar = sample.pillars[0];
if (!yearPillar.tianGan || !yearPillar.diZhi || !yearPillar.naYin || !yearPillar.wuXing || !yearPillar.mainStar || yearPillar.cangGanDetail.length === 0) {
  fail('年柱缺少天干、地支、纳音、五行、十神或藏干');
} else ok(`年柱字段齐全：${yearPillar.ganZhi} ${yearPillar.naYin} ${yearPillar.mainStar}`);
if (sample.fiveElements.length < 5) fail('五行摘要不足五项');
else ok(`五行 ${sample.fiveElements.map(item => item.element).join('')}`);

const lichun = Solar.fromYmd(2024, 2, 4).getLunar().getJieQiTable()['立春'];
if (!lichun || lichun.getHour() !== 16) fail('lunar-javascript 没有给出 2024 立春时刻');
else ok(`独立节气：2024 立春 ${lichun.getHour()}:${String(lichun.getMinute()).padStart(2, '0')}`);
const before = xuantianPillars('2024-02-04', '16:00', 2);
const after = xuantianPillars('2024-02-04', '17:00', 2);
if (before !== lunarPillars(2024, 2, 4, 16, 0, 2) || after !== lunarPillars(2024, 2, 4, 17, 0, 2)) {
  fail(`立春前后四柱不一致 before=${before} after=${after}`);
} else if (before.slice(0, 2) === after.slice(0, 2)) fail('立春前后年柱没有变化');
else ok(`立春前 ${before}；立春后 ${after}`);

const lateZi = xuantianPillars('1990-08-15', '23:00', 2);
const earlySwap = xuantianPillars('1990-08-15', '23:00', 1);
const midnight = xuantianPillars('1990-08-16', '00:00', 2);
if (lateZi !== lunarPillars(1990, 8, 15, 23, 0, 2)) fail(`23点晚子时和独立历法不一致 ${lateZi}`);
else if (earlySwap !== lunarPillars(1990, 8, 15, 23, 0, 1)) fail(`23点换日和独立历法不一致 ${earlySwap}`);
else if (lateZi.split(' ')[2] === earlySwap.split(' ')[2]) fail('两种子时的日柱没有分开');
else if (midnight !== lunarPillars(1990, 8, 16, 0, 0, 2) || midnight.split(' ')[2] !== earlySwap.split(' ')[2]) {
  fail(`0点日柱没有接上换日：${midnight}`);
} else ok('23:00 两种子时、以及次日 00:00，都和 lunar-javascript 一致');

for (const bad of ['2001-02-29', '1900-02-29']) {
  try {
    castBazi({ gender: 'male', calendar: 'solar', birthDate: bad, birthTime: '12:00', leapMonth: false, sect: 2, trueSolar: false });
    fail(`${bad} 被当成合法公历`);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('公历') && !message.includes('日期')) fail(`${bad} 的错误不可读：${message}`);
    else ok(`${bad} 拒绝：${message}`);
  }
}
const leapDay = castBazi({
  gender: 'male', calendar: 'solar', birthDate: '2000-02-29', birthTime: '12:00',
  leapMonth: false, sect: 2, trueSolar: false,
});
if (leapDay.pillars.map(item => item.ganZhi).join(' ') !== lunarPillars(2000, 2, 29, 12, 0, 2)) fail('闰日 2000-02-29 四柱不一致');
else ok('公历闰日 2000-02-29 可排，并与独立历法一致');

const lunarChart = castBazi({
  gender: 'male', calendar: 'lunar', birthDate: '2024-01-01', birthTime: '08:00',
  leapMonth: false, sect: 2, trueSolar: false,
});
const solarNewYear = castBazi({
  gender: 'male', calendar: 'solar', birthDate: '2024-02-10', birthTime: '08:00',
  leapMonth: false, sect: 2, trueSolar: false,
});
if (!lunarChart.solarDatetime.startsWith('2024-02-10') || lunarChart.pillars.map(item => item.ganZhi).join() !== solarNewYear.pillars.map(item => item.ganZhi).join()) {
  fail(`农历正月初一没有落到公布的 2024-02-10：${lunarChart.solarDatetime}`);
} else ok('农历 2024 正月初一等于公历 2024-02-10，四柱相同');

const plainMonth = castBazi({
  gender: 'female', calendar: 'lunar', birthDate: '2023-02-01', birthTime: '08:00',
  leapMonth: false, sect: 2, trueSolar: false,
});
const leapMonth = castBazi({
  gender: 'female', calendar: 'lunar', birthDate: '2023-02-01', birthTime: '08:00',
  leapMonth: true, sect: 2, trueSolar: false,
});
const leap2023 = LunarYear.fromYear(2023).getMonths().some(month => month.getMonth() === -2);
if (!leap2023) fail('2023 农历闰二月这一公开月份没有被 lunar-javascript 确认');
else if (plainMonth.solarDatetime === leapMonth.solarDatetime) fail('闰二月和二月被排成同一天');
else ok(`2023 二月 ${plainMonth.solarDatetime}，闰二月 ${leapMonth.solarDatetime}`);
try {
  castBazi({
    gender: 'male', calendar: 'lunar', birthDate: '2024-02-01', birthTime: '08:00',
    leapMonth: true, sect: 2, trueSolar: false,
  });
  fail('2024 不存在的闰二月被接受了');
} catch (error) {
  ok(`不存在的闰月被拒绝：${error instanceof Error ? error.message : '错误'}`);
}

const directionBirth = { calendar: 'solar' as const, birthDate: '1984-06-15', birthTime: '10:00', leapMonth: false, sect: 2 as const, trueSolar: false };
const male = castBazi({ ...directionBirth, gender: 'male' });
const female = castBazi({ ...directionBirth, gender: 'female' });
const month = male.pillars[1].ganZhi;
const maleFirst = male.decades.find(item => item.label);
const femaleFirst = female.decades.find(item => item.label);
const yearStem = male.pillars[0].tianGan;
const yangYear = GAN.indexOf(yearStem) % 2 === 0;
if (!yangYear || !maleFirst || !femaleFirst) fail('顺逆样本没有年干或大运');
else if (maleFirst.label !== stepGanZhi(month, 1) || femaleFirst.label !== stepGanZhi(month, -1)) {
  fail(`阳年男女大运顺逆不对：月柱 ${month}，男 ${maleFirst.label}，女 ${femaleFirst.label}`);
} else ok(`阳年 ${yearStem}：男顺 ${maleFirst.label}，女逆 ${femaleFirst.label}`);

const winterOffset = zoneOffsetMinutes('Asia/Shanghai', new Date('1988-01-15T01:30:00Z'));
const summerOffset = zoneOffsetMinutes('Asia/Shanghai', new Date('1988-07-14T17:30:00Z'));
const dst = castBazi({
  gender: 'male', calendar: 'solar', birthDate: '1988-07-15', birthTime: '01:30',
  leapMonth: false, sect: 2, trueSolar: true, longitude: 120,
});
if (summerOffset - winterOffset !== 60) fail(`IANA 没有把 1988 夏令时记成多 60 分钟：冬 ${winterOffset} 夏 ${summerOffset}`);
else if (!dst.dstApplied || dst.chartDatetime.startsWith('1988-07-15T01:30')) fail(`八字库没有按夏令时改排盘时刻：${dst.chartDatetime}`);
else ok(`1988 夏令时：IANA 差 ${summerOffset - winterOffset} 分钟，排盘时刻 ${dst.chartDatetime}`);

const shifted = castBazi({
  gender: 'male', calendar: 'solar', birthDate: '2000-01-15', birthTime: '00:20',
  leapMonth: false, sect: 2, trueSolar: true, longitude: 75,
});
const unshifted = castBazi({
  gender: 'male', calendar: 'solar', birthDate: '2000-01-15', birthTime: '00:20',
  leapMonth: false, sect: 2, trueSolar: false, longitude: 75,
});
const direct = calculateChart({
  gender: 'male', calendar: 'solar', birthDate: '2000-01-15', birthTime: '00:20',
  sect: 2, trueSolarTime: true, longitude: 75, timeZone: 'Asia/Shanghai',
});
const doubled = calculateChart({
  gender: 'male', calendar: 'solar', birthDate: '2000-01-14', birthTime: '21:20',
  sect: 2, trueSolarTime: true, longitude: 75, timeZone: 'Asia/Shanghai',
});
if (shifted.chartDatetime === unshifted.chartDatetime) fail('东经 75° 的真太阳时没有改变 00:20');
else if (!shifted.chartDatetime.startsWith('2000-01-14')) fail(`真太阳时没有跨过前一日：${shifted.chartDatetime}`);
else if (shifted.chartDatetime !== direct.chartDateTime) fail('封装和库的原始调用排盘时刻不同，可能多做了校正');
else if (shifted.chartDatetime === doubled.chartDateTime) fail('预先平移后再打开真太阳时，结果却和一次校正相同');
else ok(`真太阳时只校正一次：${unshifted.chartDatetime} → ${shifted.chartDatetime}`);

console.log('  · 未做界面：流月、流日。库能算，但本版没有单独验证后的选择器。');
console.log('  · 未覆盖：出生地纬度、Asia/Shanghai 以外的时区。表单没有这些字段，调用时不编造。');
console.log('  · 紫微真太阳时仍是经度差，八字真太阳时是库内的均时差和夏令时。测试不断言两套时辰相同。');

if (failures) {
  console.error(`\n${failures} 项失败`);
  process.exit(1);
}
console.log('\n八字 xuantian-bazi 集成通过');
