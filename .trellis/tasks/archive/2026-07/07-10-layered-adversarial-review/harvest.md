# Harvest — 分层 fusion 打磨改造

## 分拣

- **skill/流程沉淀**：pb-adversarial-review 已从"单轮 spec 审查"升级为"三层 fusion 打磨"（本任务交付物本身即沉淀）。fusion-howto.md 固化了本会话踩出的 fusion 实操坑（见下 memory）。
- **坑 / 反模式**：
  - "想用机器验证审查质量"是伪命题——任何机器可判的结构，LLM 都能秒生成格式合规的废话绕过。三家跨厂商 fusion + 用户实证一致证明。→ 门禁只能是"验存在的地板"，质量靠 fusion 狠 + 人把关。
  - 单份→多份门禁是**行为变更非叠加**：现有测试会翻红、存量任务会被冻结（需 grandfather 迁移）。改门禁必查这两点。
  - "唯一代码改动"类作用域表述会污染风险评估（测试/skill frontmatter 都是行为相关）。
- **先例资产**：本任务的 prd/design/implement + 三份 fusion review 记录，是"如何用 fusion 分层打磨 + 如何诚实收敛一个反复被证伪的设计"的完整先例。
- **memory（跨会话）**：fork 维护要点已更新（fusion 实操坑 + 机器验不了质量的定律 + 三轮 dogfood 模式）。
- **无收获项**：无。

## 完成边界（诚实）

- fork 侧代码+文档改完、lint/typecheck/test/E2E 全绿、trellis-check 通过。
- **未提交、未推送**（等用户确认）。
- **未传播到 topbi**（fork 提交后另做，Step7）。
- playbook 的测试轮/skill dogfood 轮仍未做（D7，另立任务）。
