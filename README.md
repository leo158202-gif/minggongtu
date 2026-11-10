<div align="center">

# 命宫图

命宫图 v3.1.0。填写一次出生年月日时，在浏览器里看紫微斗数、八字或西洋占星本命盘。v3.0.0 是八字版的已验收快照（提交 `201d59f`）。v2.0.0 是八字接入前的稳定快照：https://github.com/leo158202-gif/minggongtu/releases/tag/v2.0.0 （提交 `d54c682c259245c9366414b79b6a8e98566e57b8`）。

</div>

排盘引擎来自开源项目 [ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)（作者：王多鱼AI）。代码协议见 [MIT License](./LICENSE)。本仓库只做本地排盘站的界面，不包含上游的 AI 解读接口、账号、支付和部署配置。

英文对照仍可看上游简介：[README.en.md](./README.en.md)。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。首页点「立即起盘」，或直接打开 [/chart](http://localhost:3000/chart)。占星入口是 [/astro](http://localhost:3000/astro)，也可以在起盘页切换到「占星」。

1. 在表单里选择公历年月日、时辰和性别，提交后起盘。
2. 命盘上方切换 **本命**、**大限**、**流年**。流年可以改年份。
3. 页头可以切换亮色和暗色，选择记在本机。

排盘不需要 API Key。紫微和八字在浏览器内计算。西洋占星本命盘由本站服务端用 Caelus 计算，不把星历库打进紫微页面。右侧追问要在服务端配置 `MINGGONGTU_AI_API_KEY`，见 `.env.example`。未配置时追问会提示暂不可用，排盘仍然可用。紫微、八字和占星的对话分开，换盘或换出生资料后不会串上下文。

可选检查：

```bash
npm run typecheck
npm test
```

## 这一版有什么

- 品牌是命宫图。站点标题、导航和首页主标题用这个名字。
- 配色是深墨底加暖金，写在 `app/globals.css` 的 CSS 变量里。亮色用暖纸底，暗色用深墨底。
- `/chart` 用仓库里的 `generateChart()` 起盘。宫格布局和点击交互沿用上游命盘组件。
- `/astro` 排西洋占星本命盘：行星、宫位、相位、上升和星盘图。行运是排盘时刻的快照。合盘未做。

## 这一版没有什么

- 命盘页可以在紫微斗数、八字和占星之间切换，出生资料保留。紫微右侧上面是固定说明，下面是 DeepSeek 追问。八字盘展示四柱、藏干、十神、五行、纳音、大运和流年，追问只带八字上下文。占星展示本命星盘、行星、宫位、相位和排盘时刻的行运快照，追问只带这份结构。密钥只在服务端，对话不落库。
- 八字计算使用 [xuantian-bazi](https://github.com/sfwal/xuantian-bazi) 0.2.0（MIT）。年柱、月柱按节气。输入按北京时间。真太阳时和 23 点换日可以单独开关，校正只做一次。
- 占星计算使用 [caelus](https://github.com/heavyblotto/caelus) 0.25.0 和 caelus-birth 0.25.0（都是 MIT，不含 Swiss Ephemeris / AGPL）。星盘要纬度、经度和时区。夏令时重叠要用户选较早或较晚的一次；被拨掉的钟面时间要确认后才排。真太阳时不参与占星。合盘这一轮没有做。度数没有在本项目里独立复算。
- 不做登录、支付、部署，也不向上游仓库提交改动。

## 来源

> 排盘引擎：ziwei-doushu  
> 作者：王多鱼AI  
> 来源：https://github.com/Renhuai123/ziwei-doushu  
> 代码：MIT
