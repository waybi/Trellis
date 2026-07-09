# Fork Trellis 融合 feature-delivery-playbook 工作流

## Goal

在 fork（`waybi/Trellis`，分支 `my-workflow`）的模板层融合 feature-delivery-playbook 方法论，做成通用自有发行版：任何项目 `trellis init` 即自带该工作流。核心三条线：**对抗审查守规约（防幻觉上游）、持续交付纪律、证据留档→先例库→harvest 的资产飞轮**。所有改动按隔离分层架构组织，最小化上游 rebase 冲突。

## Background

- 方法论来源：`/Users/waybi/Desktop/topgames/topbi/docs/guides/feature-delivery-playbook.md`（10 阶段 + 3 条持续动作线）
- 用户场景：每个项目都用、要通用 → fork 而非项目级定制
- 核心洞察（用户纠偏）：fusion 的主战场是**行为规约对抗审查**——规约质量决定实施 agent 幻觉率（use-gross-pay：fusion 审 spec v1 → 30 问题/4 Blocker → v2 后"实施 agent 照着写就行"）。Trellis 中行为规约 = prd.md + design.md + implement.md + jsonl 清单
- fork 已就绪：origin = `git@github.com:waybi/Trellis.git`，基线 v0.6.6（41b6a460），`main` 跟上游、定制在 `my-workflow`

## Decisions（全部已确认，2026-07-09）

| # | 决策 | 要点 |
|---|---|---|
| D1 | fusion 硬门禁 + 任务分级 | 复杂任务（有 design.md）强制；轻量任务（PRD-only）豁免；config 开关默认开。最高优先级门禁点 = `task.py start` 前（规约未审不得进 Execute） |
| D2 | 交付规则 = 纯项目级 spec 约定 | 模板只写通用 commit 纪律 + "若 `.trellis/spec/guides/delivery.md` 存在必须遵守"；Gerrit 细节留各项目；fork 附 delivery-gerrit 示例模板。不做结构化 config（无代码消费即伪配置） |
| D3 | 本地构建 + 全局安装 | 不改包名不发 npm；`pnpm build && npm i -g ./packages/cli`；将来团队共享再改名发布 |
| D4 | 门禁执行层 = 脚本级拦 start + archive | start 校验规约对抗审查证据；archive 校验 harvest/完成诚实性；中间节点提示词级；轻量任务豁免 |
| D5 | 跟踪式 fork | `main` 跟上游定期 rebase；改动策略为 rebase 优化 |
| D6 | 找先例三路降级 | ① 仓库内先例（核对同构）/ ② 外部先例（trellis-research）/ ③ 显式宣告 de-novo 并记入 spec-review.md（触发更严 fusion）。③ 是合格结论；先例库随任务自增长 |
| D7 | harvest 一等环节 | Phase 3.3 升级为回顾收获：程序性知识→skill / 坑→lore 或 spec / 先例资产→先例库 / 决策→memory / 无收获显式宣告。skill 提炼判据：同类操作 ≥2 次。archive 门禁校验 harvest 已跑 |
| D8 | 对抗审查两级降级，门禁验证据不验工具 | L1 = fusion 多模型；L2 = trellis channel 原生（Pattern C parallel reviewers + opposition brief，`workflows.md:43,74-94`；单 provider 靠 fresh-context worker 补偿）。证据文件声明 `review-level: L1/L2` + providers；静默跳过违规、降级合规。门禁只查证据文件 |
| D9 | 隔离分层架构（用户强调） | 见 design.md 分层模型：L1 新增文件区（零冲突）承载全部内容；L2 触点区（上游文件最小插入，只放指针）；L0 上游区不碰 |

## Requirements

- **R1 对抗审查门禁**：新 bundled skill 承载 L1/L2 降级流程与证据格式（`spec-review.md`，含 `review-level` 声明 + 逐条决议）；`task.py start` 对复杂任务校验证据，缺失拒绝进入 Execute；config 开关默认开
- **R2 交付纪律**：按逻辑单元持续提交进 workflow 提示；`.trellis/spec/guides/delivery.md` 存在即必须遵守（按 D2）；附 Gerrit 示例模板
- **R3 找先例**：新增独立 skill 承载三路降级（按 D6），workflow planning 阶段挂指针；不改上游 brainstorm.md
- **R4 harvest**：新 bundled skill 承载分拣决策树与沉淀模板（按 D7）；`task.py archive` 对复杂任务校验 harvest 证据；不改上游 update-spec.md
- **R5 通用性**：全部内容平台无关，经 configurators 自动分发 17 平台；不做平台特定改动
- **R6 隔离分层（按 D9）**：新增文件优先；上游文件触点 ≤ 4 处且每处 ≤ 5 行指针式插入；触点带 `pb:` 标记注释便于 rebase 冲突时快速重放

## Technical Notes（代码勘察确认，基线 v0.6.6）

- 上游官方支持 fork：`templates/trellis/workflow.md` 末尾 "Customizing Trellis (for forks)" 章节；workflow.md 是唯一事实源，`inject-workflow-state.py` 只是解析器
- fork 必须保持的上游不变量：triage + 建任务同意；轻量/复杂 artifact 分级；Phase 3.4 commit 提醒可达
- **skills / bundled-skills 目录自动发现**（`common/index.ts` `readdirSync`）：新增零注册改动
- 上游测试为"至少存在"断言，新增 skill 不破坏；config.yaml 有 `applyConfigSectionsAdded` 节追加机制
- 门禁落点：`templates/trellis/scripts/task.py:cmd_start`（L70）；`cmd_archive` 在 `common/task_store.py`
- config 读取：`common/config.py` `_load_config` + `get_*` 访问器模式，可被新模块 import 复用
- lifecycle hooks 非阻塞（"print a warning but do not block"），故硬门禁必须走脚本内校验而非 hooks
- v0.6.6 新增 `.omp` 平台（17 个），configurator 模式不变
- AGPL-3.0：本地构建自用零义务；公开分发才触发开源义务
- core 包（channel/task/mem）无需改动

## Acceptance Criteria

- [ ] 临时仓库 `trellis init` 后：新 bundled skills（对抗审查 / harvest）与 find-precedent skill 就位；workflow 注入含三线指针；config.yaml 含 playbook 节
- [ ] 复杂任务（有 design.md）无 `spec-review.md` 时 `task.py start` 报错拒绝；补齐证据后通过；轻量任务不受影响
- [ ] 复杂任务无 harvest 证据时 `task.py archive` 拒绝；config 开关关闭后门禁不生效
- [ ] 上游不变量保持（triage/consent、artifact 分级、3.4 commit 可达）
- [ ] 上游 src 文件触点 = 6（task.py / task_store.py / config.yaml / workflow.md / trellis/index.ts / shared.ts，后两处为实施中发现的结构性必需注册点）+ 2 个测试文件调整，全部在 design.md 冲突面预算表内且可 grep 到 pb 标记（breadcrumb 块内以 `pb-` skill 名前缀为标记，避免每轮注入噪音）
- [ ] `pnpm lint && pnpm typecheck && pnpm test` 全绿
- [ ] `pnpm build && npm i -g ./packages/cli` 后 `trellis init` 走通

## Out of Scope

- core 包改动；平台 configurator 改动
- topbi 项目内容（Gerrit 规则细节留 topbi 项目级 spec）
- npm 发布 / 改名（D3 保留为未来升级路径）
- 上游 brainstorm.md / update-spec.md / check.md 的正文改写（内容全部走新增文件 + 指针）
