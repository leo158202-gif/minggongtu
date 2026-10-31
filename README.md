<div align="center">

# 命宫图

本地紫微斗数排盘。填写出生年月日时，在浏览器里生成本命盘，并切换大限与流年。

</div>

排盘引擎来自开源项目 [ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)（作者：王多鱼AI）。代码协议见 [MIT License](./LICENSE)。本仓库只做本地排盘站的界面，不包含上游的 AI 解读接口、账号、支付和部署配置。

英文对照仍可看上游简介：[README.en.md](./README.en.md)。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。首页点「立即起盘」，或直接打开 [/chart](http://localhost:3000/chart)。

1. 在表单里选择公历年月日、时辰和性别，提交后起盘。
2. 命盘上方切换 **本命**、**大限**、**流年**。流年可以改年份。
3. 页头可以切换亮色和暗色，选择记在本机。

排盘不需要 API Key，命盘在浏览器内计算。右侧 AI 追问要在服务端配置 `MINGGONGTU_AI_API_KEY`，见 `.env.example`。未配置时追问会提示暂不可用，排盘仍然可用。

可选检查：

```bash
npm run typecheck
npm test
```

## 这一版有什么

- 品牌是命宫图。站点标题、导航和首页主标题用这个名字。
- 配色是深墨底加暖金，写在 `app/globals.css` 的 CSS 变量里。亮色用暖纸底，暗色用深墨底。
- `/chart` 用仓库里的 `generateChart()` 起盘。宫格布局和点击交互沿用上游命盘组件。

## 这一版没有什么

- 命盘页右侧上面是固定说明，下面是 DeepSeek 追问。密钥只在服务端，对话不落库。
- 不做登录、支付、部署，也不向上游仓库提交改动。

## 来源

> 排盘引擎：ziwei-doushu  
> 作者：王多鱼AI  
> 来源：https://github.com/Renhuai123/ziwei-doushu  
> 代码：MIT
