/**
 * 本机 AI 连接设置。密钥只写在用户主目录，不进仓库、不进安装包、不打日志。
 * 有本机文件时优先于环境变量；文件不存在时才用环境变量，方便原来的服务器部署。
 */
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { DEEPSEEK_CHAT_COMPLETIONS_URL, DEEPSEEK_MODEL, readAiApiKey } from './ai-interpret';

export interface LocalAiSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AiConnection {
  apiKey: string;
  url: string;
  model: string;
  source: 'local' | 'env' | 'none';
}

const FILE_NAME = 'ai-settings.json';

export function aiConfigPath(env: Record<string, string | undefined> = process.env): string {
  const override = env.MINGGONGTU_AI_CONFIG?.trim();
  if (override) return override;
  return path.join(homedir(), '.minggongtu', FILE_NAME);
}

export async function loadLocalAiSettings(env: Record<string, string | undefined> = process.env): Promise<LocalAiSettings | null> {
  try {
    const raw = await readFile(/*turbopackIgnore: true*/ aiConfigPath(env), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    return {
      apiKey: typeof record.apiKey === 'string' ? record.apiKey.trim() : '',
      baseUrl: typeof record.baseUrl === 'string' ? record.baseUrl.trim() : '',
      model: typeof record.model === 'string' ? record.model.trim() : '',
    };
  } catch {
    return null;
  }
}

export async function saveLocalAiSettings(settings: LocalAiSettings, env: Record<string, string | undefined> = process.env): Promise<void> {
  const file = aiConfigPath(env);
  const directory = path.dirname(file);
  await mkdir(/*turbopackIgnore: true*/ directory, { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(/*turbopackIgnore: true*/ tmp, JSON.stringify({
    apiKey: settings.apiKey.trim(),
    baseUrl: settings.baseUrl.trim(),
    model: settings.model.trim(),
  }), { mode: 0o600 });
  await chmod(/*turbopackIgnore: true*/ tmp, 0o600);
  await rename(/*turbopackIgnore: true*/ tmp, file);
  await chmod(/*turbopackIgnore: true*/ file, 0o600);
}

export function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return DEEPSEEK_CHAT_COMPLETIONS_URL;
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}

export async function resolveAiConnection(env: Record<string, string | undefined> = process.env): Promise<AiConnection> {
  const local = await loadLocalAiSettings(env);
  if (local) {
    return {
      apiKey: local.apiKey,
      url: chatCompletionsUrl(local.baseUrl),
      model: local.model || DEEPSEEK_MODEL,
      source: 'local',
    };
  }
  const apiKey = readAiApiKey(env);
  return {
    apiKey,
    url: DEEPSEEK_CHAT_COMPLETIONS_URL,
    model: DEEPSEEK_MODEL,
    source: apiKey ? 'env' : 'none',
  };
}

export function isLocalSettingsHost(host: string | null): boolean {
  if (!host) return false;
  const name = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return name === 'localhost' || name === '127.0.0.1' || name === '::1';
}

export function validateAiSettingsInput(input: { apiKey?: string; baseUrl?: string; model?: string; clearKey?: boolean }): { ok: true; apiKey: string; baseUrl: string; model: string; clearKey: boolean } | { ok: false; error: string } {
  const apiKey = (input.apiKey ?? '').trim();
  const baseUrl = (input.baseUrl ?? '').trim();
  const model = (input.model ?? '').trim();
  if (apiKey.length > 500 || /[\r\n]/.test(apiKey)) return { ok: false, error: '密钥格式不对。' };
  if (baseUrl) {
    if (baseUrl.length > 200) return { ok: false, error: '接口地址太长。' };
    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      return { ok: false, error: '接口地址需要以 http:// 或 https:// 开头。' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false, error: '接口地址只接受 http 或 https。' };
    if (parsed.username || parsed.password) return { ok: false, error: '请把密钥填在密钥栏，不要写进地址。' };
  }
  if (model && !/^[A-Za-z0-9._:-]{1,80}$/.test(model)) return { ok: false, error: '模型名只接受字母、数字和 . _ : -。' };
  return { ok: true, apiKey, baseUrl, model, clearKey: input.clearKey === true };
}
