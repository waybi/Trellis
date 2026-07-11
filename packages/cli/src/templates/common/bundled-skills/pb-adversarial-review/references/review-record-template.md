# 挑刺记录格式：prd-review / design-review / implement-review

分层打磨每层产出一份挑刺记录，写在任务目录下（与 `prd.md` 同级）：

- `prd-review.md`
- `design-review.md`
- `implement-review.md`

它们是 `task.py start` 门禁（`pb_gate.py:check_start_gate`）的校验对象。**门禁只做结构校验（文件在 + 非空 + 有 review-level 行 + ≥1 决议标记），不做语义校验。** 这些记录是**给人看的过程留痕**，不是给机器校验的门禁凭证——不要为了过门禁伪造空决议，那等于把幻觉风险原样带进实施阶段。

## 门禁校验字段（最小结构契约）

每份记录，以下三项缺一不可：

| # | 校验项 | 说明 |
|---|---|---|
| 1 | 文件存在且非空 | `<task-dir>/<layer>-review.md` |
| 2 | `review-level:` 声明行 | 独立一行，值为 `L1` / `L1-degraded` / `L2` |
| 3 | 至少一条决议标记 | 行内含 `✅` / `❌` / `⏳` 之一，或 `- [x]` 形式 |

## 共享骨架

```markdown
review-level: L1
mechanism: 3× 并行（opus / agnes / minimax），主会话 arbiter
degrade-note: <降级留痕；无降级写"无">
date: <YYYY-MM-DD>
inputs: <本层被审文档 + 不变量 + 证据引用>

# <PRD | Design | Implement> Review: <任务标题>

## 审查方式

<一两句：几家模型 / 各自视角；降级情况如实写>

## 逐条决议

- ✅ <问题摘要> — 采纳，契约已改：<改到哪个文件哪一节>
- ❌ <问题摘要> — 反驳：<证据（grep 结果 / 文件:行号 / 用户原话）>
- ⏳ <问题摘要> — 存疑：<验证方式 + 谁在何时验证>

## Blocker 汇总

<被评为 Blocker 的问题及最终去向；无则写"无 Blocker">

## 结论

<本层终稿是否就绪；仍开放的 ⏳ 项是否阻塞进入下一层 / start>
```

## 字段说明

- `review-level`：`L1` = 真跨家族 fusion；`L1-degraded` = 单家族 fusion（跨家族盲区未覆盖）；`L2` = fresh-context sub-agent 降级。如实声明，降级合规。
- `degrade-note`：**降级必填**。写明"实际跨几族、剔除了哪些模型、降级原因"。静默降级（换载体不写原因）违规。
- 决议标记语义：
  - `✅` 采纳——问题成立，本层文档已改（写明改到哪）
  - `❌` 反驳——问题不成立，**必须附证据**（grep / 文件:行号 / 用户原话），"我以为"不算证据
  - `⏳` 存疑——暂无法定论，写明验证计划；含 Blocker 级 ⏳ 时不应定稿

## implement-review 额外要求：引用 design 发现（防复读）

`implement-review.md` 除逐条决议外，**必须显式引用 design 轮发现并标注**，防止退化成复制 design 的发现：

```markdown
## 对 design 轮发现的处理

- [采纳] <design 轮 BDn 摘要> — implement 层沿用：<如何落到执行步骤>
- [反驳] <design 轮 BDn 摘要> — implement 层不适用：<理由 + 证据>
- [独有] <implement 层新发现（design 未覆盖）> — <执行顺序 / 回滚 / 验证充分性>
```

这是"强制轮次耦合、防复读"，不是机器验质量——没有任何机器会校验这段引用的真伪，靠人把关。

## 迁移兼容（grandfather）

旧单轮体系建的任务用单份 `spec-review.md`。门禁规则：`spec-review.md` 存在 → 整个 start-gate 视为满足（旧任务不追溯三份）。新任务不产 `spec-review.md`（产上述三份），自然受三份约束。此迁移逻辑在 `pb_gate.py`。

## 反例

```markdown
review-level: L1
## 逐条决议
- ✅ 整体没问题
```

结构上能过门禁，但这是"总体赞扬"不是逐条决议——审查白跑。每条决议必须对应具体问题，且问题来自真实的对抗轮次。门禁验不出这种造假（这正是"机器验不了语义质量"的例证），只有人把关能拦住。
