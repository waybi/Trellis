# spec-review.md 证据文件格式

`spec-review.md` 写在任务目录下（与 `prd.md` 同级），是 `task.py start` 门禁（`pb_gate.py:check_start_gate`）的校验对象。

## 门禁校验字段（最小结构契约）

门禁只做结构校验，以下三项缺一不可：

| # | 校验项 | 说明 |
|---|---|---|
| 1 | 文件存在且非空 | `<task-dir>/spec-review.md` |
| 2 | `review-level:` 声明行 | 独立一行，值为 `L1` 或 `L2`（如 `review-level: L1`） |
| 3 | 至少一条决议标记 | 行内含 `✅` / `❌` / `⏳` 之一，或 `- [x]` 形式 |

语义质量（问题是否真被逐条走查、反驳是否有证据）由审查流程保证，门禁不做语义校验。**不要为了过门禁伪造空决议**——那等于把幻觉风险原样带进实施阶段。

## 完整模板

```markdown
review-level: L1
providers: fusion (claude, codex, gemini)
date: <YYYY-MM-DD>
inputs: prd.md, design.md, implement.md

# Spec Review: <任务标题>

## 审查方式

<一两句：L1 fusion 几个模型 / L2 channel 几个 worker、各自视角>

## 决议

逐条记录审查提出的问题与决议。每条格式：

- ✅ <问题摘要> — 接受，规约已改：<改动点 / 落到哪个文件哪一节>
- ❌ <问题摘要> — 反驳：<证据（grep 结果 / 文件:行号 / 配置实证）>
- ⏳ <问题摘要> — 待验证：<验证方式 + 谁在何时验证>

## Blocker 汇总

<被评为 Blocker 的问题及其最终去向；无则写"无 Blocker">

## 结论

<规约 v2 是否就绪进入 Execute；仍开放的 ⏳ 项是否阻塞 start>
```

## 字段说明

- `review-level`：`L1` = fusion 多模型工具链；`L2` = trellis channel 原生（含单 provider fresh-context 补偿）。如实声明，降级合规。
- `providers`：实际参与的模型/provider 列表。L2 单 provider 时写明视角划分，如 `providers: claude x3 (data-contract / acceptance / edge-cases)`。
- 决议标记语义：
  - `✅` 接受——问题成立，规约已修改（写明改到哪）
  - `❌` 反驳——问题不成立，**必须附证据**（grep / 文件行号 / 配置实证），"我以为"不算证据
  - `⏳` 待验证——暂无法定论，写明验证计划；含 Blocker 级 ⏳ 时不应 start
- 多轮审查追加式记录：第二轮在文末加 `## 决议（第 2 轮）`，不覆盖第一轮。

## 反例

```markdown
review-level: L1
## 决议
- ✅ 整体没问题
```

结构上能过门禁，但这是"总体赞扬"不是逐条决议——审查白跑。决议条目必须对应具体问题，且问题来自真实的对抗轮次。
