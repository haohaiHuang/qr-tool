# Session Progress Log

## Current State

**Last Updated:** 2026-08-17 17:00
**Active Feature:** feat-001 项目骨架与验证链

## Status

### What's Done

- [x] Harness 五件套：AGENTS.md / feature_list.json / progress.md / init.sh / session-handoff.md
- [x] 规格文档：SPEC.md（可执行验收标准）/ PLAN.md（7 阶段）/ TASKS.md（TDD 粒度任务）
- [x] package.json + node:test 验证链（`npm test` → `node --test`，零依赖）
- [x] TDD 示例跑通：toGray/toGrayImage（Red→Green）
- [x] git init + 首次提交（381a41a）

### What's In Progress

- [x] T1.1 像素数组模块完成（灰度/裁剪/缩放/全局阈值/自适应阈值，7/7 测试）

### What's Next

1. T1.2 类型识别：定位符检测（检测三回字 Finder Pattern）
3. 后续按 TASKS.md 顺序推进

## Blockers / Risks

- [ ] 微信码结构重建（F6）依赖真实样本验证——需要用户提供小程序码截图
- [ ] jsQR/qrcode-generator 的引入方式待定（npm 依赖 vs CDN + UI 层注入）

## Decisions Made

- **[核心算法纯像素数组]**：src/ 不依赖 DOM/Canvas，保证 node 可单测
  - Context: TDD 前提；UI 是薄层负责文件→像素→渲染
- **[node:test 零依赖]**：node 24 内置测试框架，避免测试框架本身成为依赖
- **[MVP 不引 OpenCV.js]**：几何算法纯 JS 实现，控制复杂度
- **[项目位置]**：~/Desktop/Pi/qr-tool，pi 默认工作目录 ~/Desktop/Pi

## Files Modified This Session

- `AGENTS.md` - 定制（TDD 工作流 + Spec/Plan/Task + 技术栈约束）
- `SPEC.md` / `PLAN.md` / `TASKS.md` - 规格/计划/任务
- `feature_list.json` / `progress.md` / `init.sh` / `session-handoff.md` - harness
- `package.json` - 测试脚本
- `src/shared/pixels.js` - 灰度转换（TDD 示例）
- `test/pixels.test.js` - 对应测试

## Evidence of Completion

- [x] Tests pass: `npm test` → 2 pass, 0 fail
- [x] Type check: N/A（纯 JS）
- [x] Manual verification: 无（骨架阶段）

## Notes for Next Session

下一任务 T1.2 定位符检测（TASKS.md）。pixels.js 工具已齐备。

## 用户明确需求记录（2026-08-17）

- **Logo 保留**：能扫是基础；原图带 logo 的码，重生后**必须保留 logo**（当前丢失，待 T5.1/T5.3）
- **埋点保留**：原 QR 带埋点（URL 参数/tracking）时，重生码必须逐字符保留（已天然保证 + 测试加固）

## 方案变更（2026-08-17 用户决策）

- **方案 B（结构重绘）成为主方案**：保留原码模块排列/配色/logo，高清重绘；数据天然一致
- 原方案 A（重编码）降级为兜底（B 定位失败时回退）
- 动机：重编码视觉差异大（掩码/纠错重选），用户担心视觉信任与 logo 丢失
- 文档已重写：SPEC v3 / PLAN / TASKS（含 TC 清单 + 阶段 3 开发节奏）
- 待攻难点：T3.1 网格精确定位（真实图浮点误差/透视）

## 阶段 3 完成（方案 B 引擎，2026-08-17）

- T3.1 网格定位（3 Finder 仿射；修：行列坐标反、toPixel 变量遮蔽）
- T3.2 模块采样（中位数聚类 + 邻域自适应；修 modulePx=3 采样错位）
- T3.3 高清重绘（配色 + logo 中心原样叠加）
- T3.4 管道 enhance2（B 优先 → A 回退 → 自检 + 引擎标记）
- **T3.5 闸门通过**：真实微信码 → B 引擎 → 扫码逐字符一致（含 ?s=2）→ logo 保留（vision 确认）→ 47/47 测试

## MVP 完成（2026-08-18 用户确认"这版很完美"）

- 阶段 0-4 全部完成：harness / 核心基础设施 / 方案 A 兜底 / 方案 B 结构重绘 / UI
- 方案 B：网格定位 → 模块采样 → 高清重绘（保留原排列/配色/间隙圆角/logo）
- logo 还原：白环规则性检测 + 区域生长 fallback + 方形贴片（黑底）+ 内部全贴
- 预览 = 下载（1184px 统一，logo 放大 3 倍清晰）
- 53/53 测试；真实微信码扫码一致
- **关键经验**：logo 受原图分辨率限制（>3 倍放大必糊）；超清印刷需上传高清 logo

## 最终收尾（2026-08-18）

- 微信码视觉重绘（阶段 5）可行性验证：连通域元素矢量重建分类误判率高 → 弃用，采用像素保真放大
- 放大倍数实验（2.75x vs 7x）：无显著提升 → 保持 2.75x
- 架构定案：标准码结构重绘（无损）/ 微信码像素放大（受原图限制）/ 重建失败降级放大 / UI 增强重绘-原图放大切换
- UI 统一 MD-Convertor 风格；61 测试全绿

## 3D 樱花树 QR 独立模块（2026-08-26）

- 需求：reactiive.io cherry-blossom-qrcode 动效启发 → qr-tool 增加「QR 转 3D」独立模块（与增强工具两个入口）
- 原型迭代（ui/demo-3d.html）：树干加高（冠区基座高于树顶）/ 扁平视图改像素级 2D 码（3D 俯视透视畸变不可扫）/ 深色配色保证对比度 / 相机旋转过渡动效 / 上传方形码采样 / 微信圆形码 3D 浮雕验证后取消
- 正式落地：
  - `src/qr3d/layout.js`：矩阵→3D 方块布局（中心树干堆叠/冠区樱花穹顶/冠外草地/浅色地面，纯函数）
  - `src/qr3d/flat.js`：扁平可扫彩色码像素生成（深玫红/深棕/深绿 + 白底）
  - `ui/qr3d.html`：独立入口（文本实时生成 + 上传方形码采样，Three.js CDN），去掉冗余「生成 3D 树」按钮
- 关键决策：
  - 扁平视图用 2D canvas 像素级码而非 3D 方块俯视（透视畸变+方块缝隙导致不可扫）
  - 微信圆形码（小程序码）不支持：无方形模块矩阵；且无开源解码器无法验证扫码（3D 浮雕方案取消）
  - 微信个人方形码 = 标准 QR，采样管道直接支持（修复 {size, m} 键名不一致 bug）
- 测试：`test/qr3d.test.js` 8 个（区域分类/堆叠层数/浅色白底/扁平解码闭环）；全量 69/69 通过

### UI 清理（2026-08-26）

- 移除 `ui/qr3d.html` 3D 视图下方的 demo 说明卡：「这是什么」原理卡 + 「可扫码 2D 预览」卡，及其配套 `draw2d()` / `#q2d` 代码、`.side/.card/.note` CSS；`<title>` 去掉「— Demo」
- 保留：`.hint` 操作提示、「扁平扫码视图」`#flat2d`（可扫码核心）、Three.js 树渲染逻辑
- 环境注释：本机 `npm test` 因 `@zxing/library` 为 CommonJS、`src/qr/decode.js` 用命名导入，在 Node v23 下报 `ERR_MODULE_NOT_FOUND`（HEAD 未改动时同错）——项目开发机 Node 24 下全绿，属 Node 版本差异，与本次 UI 清理无关

## 树种拓展（2026-08-27）

- 需求：3D 樱花树支持其他树种
- src/qr3d/layout.js：新增 TREE_TYPES（樱花/枫树/松树/银杏：配色 + 树形 dome/cone），buildBlocks 按树形生成树冠（cone=圆锥，dome=圆顶）
- ui/qr3d.html：新增树种下拉选择 + ?tree= 深链
- 测试：+3（树种配置 / cone vs dome 堆叠差异 / 树种只影响树冠）；全量 72/72
- 无头验证：4 树种截图——粉/橙/绿/黄树冠正确，松树为绿色圆锥形（与樱花圆顶区分明显）

## 树种形状差异化（2026-08-27）

- 反馈：单纯换颜色意义不大，树冠形状需差异化
- TREE_TYPES 5 树种各有不同树形：dome 圆顶（樱花）/ flat 平顶伞（枫树）/ cone 圆锥（松树）/ pagoda 窄高柱（银杏）/ palm 裸干+顶冠（棕榈）；另加 canopyFactor 冠幅倍率
- 柳树垂枝（weep）验证表现力不足（方块体素中读不出垂枝感）→ 换成棕榈
- 测试：树形指纹互不相同；73/73 全绿
- vision 验证 5 形状：圆顶/平顶/锥形/高柱/裸干顶冠 均明显可辨
