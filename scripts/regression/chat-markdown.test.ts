/**
 * 追问正文只做安全的加粗、列表和段落，不执行 HTML。
 * 跑: npx tsx scripts/regression/chat-markdown.test.ts
 */
import { prepareChatMarkdown } from '../../components/ChatMarkdown';

let failures = 0;
const fail = (msg: string) => { console.error(`  ✗ ${msg}`); failures++; };
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

const closed = prepareChatMarkdown('先看 **成本**，再看列表。');
if (closed !== '先看 **成本**，再看列表。') fail(`闭合加粗被改掉：${closed}`);
else ok('闭合的加粗保留');

const streaming = prepareChatMarkdown('2. **控制固定成本扩');
if (streaming.includes('**')) fail(`流式半截星号还在：${streaming}`);
else ok('未闭合的结尾星号先不显示');

const html = prepareChatMarkdown('<script>alert(1)</script> **不要执行**');
if (!html.includes('<script>alert(1)</script>')) fail('HTML 被删掉或改写成可执行片段');
else ok('尖括号原样留下，交给文本节点，不执行');

const long = '甲'.repeat(80);
if (prepareChatMarkdown(long) !== long) fail('长词被截断');
else ok('长词原样保留');

if (failures) {
  console.error(`\n${failures} 项失败`);
  process.exit(1);
}
console.log('\n追问 Markdown 通过');
