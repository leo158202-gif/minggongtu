import { AI_ERRORS, completeInterpret } from '../../../lib/ziwei/ai-interpret';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 命盘 AI 追问。只在服务端读取 MINGGONGTU_AI_API_KEY，响应里只有回复或一句中文错误。
 */
export async function POST(request: Request): Promise<Response> {
  try {
    return await completeInterpret(request);
  } catch {
    return Response.json({ error: AI_ERRORS.unexpected }, { status: 500 });
  }
}
