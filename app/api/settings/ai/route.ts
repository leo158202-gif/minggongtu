import {
  isLocalSettingsHost,
  loadLocalAiSettings,
  saveLocalAiSettings,
  validateAiSettingsInput,
} from '@/lib/ziwei/ai-settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 本机 AI 设置。只接受 localhost。响应里没有完整密钥。
 */
function localOnly(request: Request): Response | null {
  if (isLocalSettingsHost(request.headers.get('host'))) return null;
  return Response.json({ error: '密钥只能在本机设置页保存。' }, { status: 403 });
}

export async function GET(request: Request): Promise<Response> {
  const denied = localOnly(request);
  if (denied) return denied;
  const local = await loadLocalAiSettings();
  return Response.json({
    configured: Boolean(local?.apiKey),
    baseUrl: local?.baseUrl ?? '',
    model: local?.model ?? '',
    localFile: Boolean(local),
  });
}

export async function POST(request: Request): Promise<Response> {
  const denied = localOnly(request);
  if (denied) return denied;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: '设置没有保存，请重试。' }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return Response.json({ error: '设置没有保存，请重试。' }, { status: 400 });
  }
  const record = payload as Record<string, unknown>;
  const parsed = validateAiSettingsInput({
    apiKey: typeof record.apiKey === 'string' ? record.apiKey : '',
    baseUrl: typeof record.baseUrl === 'string' ? record.baseUrl : '',
    model: typeof record.model === 'string' ? record.model : '',
    clearKey: record.clearKey === true,
  });
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const current = await loadLocalAiSettings();
  const apiKey = parsed.clearKey ? '' : (parsed.apiKey || current?.apiKey || '');
  if (!parsed.clearKey && !apiKey) {
    return Response.json({ error: '请先填写 AI 密钥。' }, { status: 400 });
  }
  await saveLocalAiSettings({ apiKey, baseUrl: parsed.baseUrl, model: parsed.model });
  return Response.json({ ok: true, configured: Boolean(apiKey) });
}
