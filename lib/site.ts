/**
 * 站点根地址。未配置时用本机开发地址。
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

/** 只取域名部分，用于界面上展示（如分享卡底部） */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');

/** 本站品牌。排盘术数仍是紫微斗数，产品名用命宫图。 */
export const SITE_NAME = '命宫图';
export const SITE_TAGLINE = '本地紫微斗数排盘';
export const SITE_TITLE = `${SITE_NAME} · ${SITE_TAGLINE}`;
export const SITE_DESCRIPTION =
  '在浏览器里填写出生年月日时，生成本命盘，并查看大限与流年。排盘在本地完成，不需要账号。';

/** 上游排盘引擎。界面可以换品牌，来源标注保留。 */
export const UPSTREAM_NAME = 'ziwei-doushu';
export const UPSTREAM_URL = 'https://github.com/Renhuai123/ziwei-doushu';
export const UPSTREAM_AUTHOR = '王多鱼AI';
export const UPSTREAM_NOTE = `排盘引擎来自 ${UPSTREAM_NAME}（${UPSTREAM_AUTHOR}，代码 MIT）`;
