西洋占星预览使用下面两个包，版本都固定在 0.25.0。

- `caelus`：https://github.com/heavyblotto/caelus ，许可证 MIT。本机计算行星、宫位、相位和上升。没有运行时依赖，不包含 Swiss Ephemeris，也不是 AGPL。
- `caelus-birth`：同一仓库的时区层，许可证 MIT。依赖 `luxon`（MIT）和 `tz-lookup`（CC0-1.0）。负责把钟面时间换成世界时，并标出夏令时的重叠和空缺。

文档：https://www.ephemengine.com/docs

命宫图没有把 `caelus-wheel`、`caelus-mcp`、`caelus-delineations-pd` 装进来。星盘图形按本站深墨暖金的样式自己画。库给出的是位置和相位，不是中文批文，页面也不写批文。

这些度数没有在本项目里用另一套星历独立复算。显示四舍五入到角分，和库的原文表可能差 1 角分。
