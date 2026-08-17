# AGENTS.md

QR 码矢量增强工具（qr-tool）的项目 harness。单 HTML 前端工具，核心算法可测试。

## 启动流程

1. `pwd` 确认工作目录（应为 ~/Desktop/Pi/qr-tool）
2. 完整读本文件
3. 读 `SPEC.md`（规格）、`PLAN.md`（计划）、`TASKS.md`（任务）——三份文档是工作依据
4. `./init.sh` 验证环境健康
5. 读 `feature_list.json` 看当前特性状态
6. `git log --oneline -5` 看最近提交

基线验证失败时，先修基线再进新范围。

## 技术栈（TDD 的前提约束）

- **核心算法**：纯 JS（ESM），只操作**像素数组**（不依赖 DOM/Canvas），保证 node 环境可单测
- **测试**：`node:test`（node 24 内置，零依赖），`npm test` 运行
- **UI**：单 HTML 薄层——负责 文件→像素数组→调核心→渲染，不含算法逻辑
- **图像库**：MVP 不引 OpenCV.js，几何算法用纯 JS 实现；jsQR/qrcode-generator 用于标准码（UI 层或可注入）

## 开发工作流（Spec → Plan → Task，逐层拆分）

任何功能开发必须按此顺序：

1. **Spec**：`SPEC.md` 定义"做什么 + 验收标准"（可测试的输入/输出约定）
2. **Plan**：`PLAN.md` 把 Spec 拆成阶段，标注依赖
3. **Task**：`TASKS.md` 把当前阶段拆成原子任务，每个任务 = 一个 TDD 循环
4. **TDD 循环**（每个任务强制）：
   - **Red**：先写失败测试（定义期望行为）
   - **Green**：写最小实现让测试通过
   - **Refactor**：清理，保持测试绿
5. 任务完成标准：对应测试通过 + 记录到 feature_list.json/progress.md

## 工作规则

- **一次一个特性**：从 `feature_list.json` 选一个未完成特性
- **测试先行**：没有测试的代码不算完成；先写测试再写实现
- **验证要求**：声称完成前必须跑 `./init.sh`（npm test）
- **在范围内**：不修改与当前特性无关的文件
- **更新产物**：会话结束前更新 progress.md 和 feature_list.json
- **留干净状态**：下个会话必须能直接跑 `./init.sh`

## 完成定义（Definition of Done）

特性完成需同时满足：

- [ ] 目标行为已实现
- [ ] 对应测试已编写并运行通过（TDD 的测试先行）
- [ ] 验收标准逐条核对（对照 SPEC.md）
- [ ] 证据记录在 feature_list.json 或 progress.md
- [ ] 仓库可从标准启动路径重启

## 会话结束

1. 更新 progress.md（当前状态）
2. 更新 feature_list.json（特性状态）
3. 记录未解决风险/阻塞
4. 安全状态时提交（描述性 message）
5. 留干净仓库

## 验证命令

```bash
./init.sh      # 完整验证（npm test）
npm test       # 单测
```

## 升级路径

- 架构决策：查 SPEC/PLAN，否则问用户
- 需求不清：查 SPEC，否则问用户
- 反复测试失败：更新 progress，标记人工审查
- 范围模糊：重读 feature_list.json 的完成定义
