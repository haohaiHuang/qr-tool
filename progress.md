# Session Progress Log

## Current State

**Last Updated:** 2026-08-17 15:20
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
