import { castAstro } from '../../../lib/astro/cast';
import { ASTRO_ERRORS } from '../../../lib/astro/errors';
import { parseAstroCastInput } from '../../../lib/astro/input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** 星盘计算。请求不落库，响应里只有盘面或一句中文说明。 */
export async function POST(request: Request): Promise<Response> {
  try {
    const payload: unknown = await request.json();
    const parsed = parseAstroCastInput(payload);
    if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    return Response.json(castAstro(parsed.input));
  } catch {
    return Response.json({ ok: false, error: ASTRO_ERRORS.failed }, { status: 500 });
  }
}
