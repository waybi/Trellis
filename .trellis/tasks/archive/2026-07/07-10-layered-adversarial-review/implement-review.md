# IMPLEMENT 轮对抗审查（真 fusion 版）

review-level: L1（真跨家族）
mechanism: 3× 并行（opus / agnes / minimax），主会话 arbiter；author grep 坐实事实
date: 2026-07-11
raw: /tmp/fx-impl-{opus,agnes,minimax}.md

## Arbiter 结论
opus + minimax 决定性收敛，findings 全是**可落地的实施 bug**（非哲学）。author grep 全部坐实。这轮 dogfood 高价值——拦下了会导致"build 红 + 存量任务冻结"的真缺陷。

## 逐条决议（全接受，均已 grep 坐实）

- ✅[Blocker] IB1 迁移缺口：存量只有 spec-review.md 的**未 start** 任务，升级后 design-review 能回退、但 prd/implement-review 无回退 → 三份 AND 必拒 → 冻结 topbi 未 start 队列。风险表用"已 start 无影响"掩盖了"未 start"。
  - **修（改 design 迁移规则）**：`spec-review.md 存在 → 整个 start-gate 视为满足（grandfather 旧任务）`。理由：有 spec-review.md = 旧单轮体系建的任务，不该追溯要三份；新任务不产 spec-review.md（新流程产 prd/design/implement-review），自然受三份约束。规避风险（新任务手搓 spec-review 绕过）= 等同 PB_SKIP，可接受。
- ✅[Blocker] IB2 现有测试必翻红：grep 坐实 pb.test.ts:214-218「只放 spec-review→GATE_PASS」等用例，三份门禁后语义反转。计划只说"加新用例"漏"改旧用例"。
  - **修**：Step4 显式列"改写现有 start-gate 用例"子步；grandfather 用例（只 spec-review→pass）保留，"只 spec-review 无回退→pass"改为体现 grandfather 语义。
- ✅[Blocker] IB3「唯一代码改动 pb_gate.py」误导：pb.test.ts 是可执行代码；SKILL frontmatter description 影响 skill 路由（行为）。污染改动面/风险评估。
  - **修**：改述为"代码改动 = pb_gate.py + pb.test.ts；行为相关文档 = SKILL(含 frontmatter)/workflow"。
- ✅[Major] IM1 archive/其他调用者耦合：**grep 已坐实 FILE_SPEC_REVIEW 只在 pb_gate.py 内用，archive/task.py 不引用 → 无耦合，安全**。（fusion 要求的排查已做，结论：不动 archive 成立。）
- ✅[Major] IM2 evidence-format 悬空引用：grep 坐实 3 处（l2-channel-review.md:93、SKILL.md:58、SKILL.md:72）。
  - **修**：不删 evidence-format.md，改为**重构为 review-record-template 并同步更新这 3 处引用**；Step2 增"同步引用"子步；pb.test.ts references 计数断言相应更新。
- ✅[Major] IM3 回退成本被低估：不止 git revert，含已分发项目的模板/workflow 反向传播 + skill description 路由摇摆。
  - **修**：风险表回退列扩为四维（代码 / init 产物模板 / 已分发项目本地 / skill 路由）；且 grandfather 规则本身大幅降低"需回退"的概率（存量不被卡）。
- ✅[Minor] Im1「回退摘 design 一道」措辞不清 → 回退方案明确为"整体回单份 spec-review 语义"，不搞非对称。
- ✅[Minor] Im2 workflow breadcrumb 加行 vs 解析正则：Step4 增"先贴现有正则 + planning 块样本，diff 加行后切片仍正确"验证。
- ✅[Minor] Im3 E2E 只测 init 不测 update：Step5 增 **update 路径**验证（模拟存量只有 spec-review 的任务升级后 start → grandfather 过）。

## 结论
三份→需迁移 grandfather（IB1）、测试需改写非新增（IB2）、改动面表述需修正（IB3）、evidence-format 引用需同步（IM2）、E2E 补 update 路径（Im3）。全部折入 implement 终稿 + design 迁移规则。archive 无耦合已坐实（IM1）。可进入实施（待用户放行）。
