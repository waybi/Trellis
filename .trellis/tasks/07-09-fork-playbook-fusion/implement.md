# Implement: Fork Trellis 融合 playbook 工作流

分支：`my-workflow`（基线 v0.6.6 / 41b6a460）。按 L1 先行、L2 收尾的顺序，每步可独立验证。

## Step 1 — L1: pb_gate.py 门禁模块

- [ ] 新建 `packages/cli/src/templates/trellis/scripts/common/pb_gate.py`
  - `is_complex_task` / `gates_enabled` / `check_start_gate` / `check_archive_gate`
  - 复用 `common.config._load_config`；`PB_SKIP_GATE=1` 逃生舱（黄色警告留痕）
  - 遵循 `.trellis/spec/cli/backend/script-conventions.md`（python-design skill）
- 验证：`python3 -c` 冒烟四态矩阵（复杂/轻量 × 有/无证据）；无 import 副作用

## Step 2 — L1: 三个 skill 资产

- [ ] `templates/common/bundled-skills/pb-adversarial-review/`（SKILL.md + references/：evidence-format / l2-channel-review / attack-checklist / delivery-gerrit-example）
- [ ] `templates/common/bundled-skills/pb-harvest/`（SKILL.md + references/：harvest-format / skill-extraction / precedent-report）
- [ ] `templates/common/skills/pb-find-precedent.md`
- 内容源：playbook 原文（阶段 3/6/7/10、反模式表、三条动作线）+ design.md §1.2-1.4
- 验证：`node -e` 调 `getBundledSkillTemplates()` / `getSkillTemplates()` 确认自动发现（需先 build）

## Step 3 — L2: 触点接线（4 处，全部带 pb: 标记）

- [ ] task.py `cmd_start` +3 行（门禁调用，插在 task_dir 解析后、degraded 分叉前）
- [ ] task_store.py `cmd_archive` +3 行
- [ ] config.yaml 尾部追加 `playbook:` 节
- [ ] workflow.md 4 处指针插入（planning / in_progress 及对应 inline 块、Phase 1.4 / 3.3 步骤体）
- 验证：`git diff main --stat` 确认上游文件只有这 4 个；每处可 grep 到 `pb:`

## Step 4 — 测试

- [ ] 新建 `packages/cli/test/templates/pb.test.ts`（资产发现 + 门禁行为矩阵 + config 节存在）
- [ ] `pnpm lint && pnpm typecheck && pnpm test` 全绿（含上游既有测试——确认插入未破坏 trellis.test.ts / regression.test.ts）

## Step 5 — E2E 验收

- [ ] `pnpm build && npm i -g ./packages/cli`
- [ ] 临时目录 `git init && trellis init -u waybi`：
  - pb 三资产落地到平台目录；`.trellis/scripts/common/pb_gate.py` 存在；config 含 playbook 节；workflow.md 含指针
- [ ] 门禁实测：建复杂任务（含 design.md）→ `task.py start` 被拒 → 补 spec-review.md → 通过；archive 同理；`gates: false` 全放行；轻量任务全程无感
- [ ] 上游不变量走查（triage/consent、artifact 分级、3.4 可达）

## Step 6 — 提交

- [ ] 按逻辑单元拆 commit（吃自己的狗粮）：
  1. `feat(fork): pb_gate 门禁模块 + task.py/task_store.py 接线`
  2. `feat(fork): pb-adversarial-review / pb-harvest / pb-find-precedent 资产`
  3. `feat(fork): workflow.md 指针 + config playbook 节`
  4. `test(fork): pb 资产与门禁测试`
- [ ] push `my-workflow`

## 风险与回滚

| 风险 | 缓解 |
|---|---|
| workflow.md 插入破坏 inject-workflow-state.py 解析 | 只在块内追加行、不动 `[workflow-state:*]` 标签本身；Step 4 上游测试兜底 |
| 门禁误伤正常流程 | config 开关一键放行 + PB_SKIP_GATE 逃生舱，无需回滚代码 |
| regression.test.ts 对模板 diff 敏感 | Step 4 先跑；若有清单断言失败，仅在断言处补 pb 条目（计入 L2 触点，需在 design.md 更新预算） |
| 回滚点 | 每 Step 一 commit，`git revert` 单元化 |

## 断点状态

- 规划三件套完成，等用户 review → `task.py start`（注：start 门禁是本任务交付物，本任务自身不受其约束）
