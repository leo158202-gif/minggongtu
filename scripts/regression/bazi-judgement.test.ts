/**
 * 身强身弱和喜用只复述 xuantian-bazi 已经返回的扶抑结果。
 * 跑: npx tsx scripts/regression/bazi-judgement.test.ts
 */
import { castBazi } from '../../lib/bazi/cast';
import { buildJudgement } from '../../lib/bazi/judgement';

let failures = 0;
const fail = (msg: string) => { console.error(`  ✗ ${msg}`); failures++; };
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

const weak = castBazi({
  gender: 'female', calendar: 'solar', birthDate: '1988-07-21', birthTime: '04:15',
  leapMonth: false, sect: 2, trueSolar: false, longitude: 113.3, timeBasis: 'standard',
});
if (weak.chartDatetime !== '1988-07-21T04:15:00' || weak.pillars.map(item => item.ganZhi).join(' ') !== '戊辰 己未 丁丑 壬寅') {
  fail(`1988 默认盘被判定改动了 ${weak.chartDatetime}`);
} else if (weak.judgement.label !== '偏弱' || weak.judgement.useful.join('') !== '木火') {
  fail(`1988 丁日不是库给出的偏弱、喜用木火：${weak.judgement.label} ${weak.judgement.useful.join('')}`);
} else if (!weak.judgement.bar || weak.judgement.bar.support >= weak.judgement.bar.oppose) {
  fail('1988 扶抑分值没有和偏弱一致');
} else if (weak.judgement.useful.join('') === '金土' || weak.judgement.bar.support === 4.9) {
  fail('把参考图的辛日数字抄到了丁日盘');
} else ok(`1988 丁日偏弱，助身 ${weak.judgement.bar.support}，耗身 ${weak.judgement.bar.oppose}，喜用木火`);

const again = castBazi({
  gender: 'female', calendar: 'solar', birthDate: '1988-07-21', birthTime: '04:15',
  leapMonth: false, sect: 2, trueSolar: false, longitude: 113.3, timeBasis: 'standard',
});
if (JSON.stringify(again.judgement) !== JSON.stringify(weak.judgement)) fail('同一输入两次判定不同');
else ok('同一输入判定稳定');

const strong = castBazi({
  gender: 'male', calendar: 'solar', birthDate: '1984-02-10', birthTime: '08:00',
  leapMonth: false, sect: 2, trueSolar: false, timeBasis: 'standard',
});
if (strong.judgement.label !== '偏旺' || strong.judgement.dayMaster !== '甲') {
  fail(`甲木春生没有判成偏旺：${strong.judgement.dayMaster} ${strong.judgement.label}`);
} else ok(`1984-02-10 甲日 ${strong.judgement.label}`);

const solarOn = castBazi({
  gender: 'female', calendar: 'solar', birthDate: '1988-07-21', birthTime: '04:15',
  leapMonth: false, sect: 2, trueSolar: true, longitude: 113.3, timeBasis: 'standard',
});
const both = castBazi({
  gender: 'female', calendar: 'solar', birthDate: '1988-07-21', birthTime: '04:15',
  leapMonth: false, sect: 2, trueSolar: true, longitude: 113.3, timeBasis: 'wall',
});
if (solarOn.chartDatetime !== '1988-07-21T03:41:51' || both.chartDatetime !== '1988-07-21T02:41:51') {
  fail(`校时被判定带偏 ${solarOn.chartDatetime} ${both.chartDatetime}`);
} else ok('打开真太阳时和两项都开，时刻仍是 03:41:51 / 02:41:51');

const mismatch = buildJudgement({
  ...blank(),
  label: '偏弱',
  element: '火',
  scores: [
    { element: '木', score: 5 },
    { element: '火', score: 5 },
    { element: '土', score: 0 },
    { element: '金', score: 0 },
    { element: '水', score: 0 },
  ],
});
if (mismatch.bar) fail('分值和库标签不一致时仍画了条');
else ok('分值对不上标签时不画百分比');

const missing = buildJudgement({ ...blank(), label: '' });
if (missing.status !== 'unknown') fail('缺标签时没有停在未判定');
else ok('缺字段时未判定');

const special = buildJudgement({ ...blank(), label: '偏弱', element: '水', pattern: '从弱格', scores: [] });
if (!special.special) fail('从格没有标成待复核');
else ok('从格只标待复核，不另造确定喜用');

function blank() {
  return {
    dayMaster: '丁', element: '火', label: '', season: '', root: '', support: '',
    seasonNote: '', rootNote: '', supportNote: '', useful: [], unfavorable: [],
    usefulNote: '', caution: '', pattern: '', scores: [],
  };
}

if (failures) {
  console.error(`\n${failures} 项失败`);
  process.exit(1);
}
console.log('\n八字扶抑判定通过');
