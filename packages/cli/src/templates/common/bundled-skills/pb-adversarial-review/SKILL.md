---
name: pb-adversarial-review
description: Layered fusion polishing of planning artifacts for complex tasks. Each layer (prd/design/implement) goes 初稿 → fusion 挑刺 → 终稿, producing prd-review.md / design-review.md / implement-review.md before task.py start. Fusion is preferred (cross-vendor models in parallel, main session as arbiter, no same-session self-review); degrade to fresh-context sub-agents with a logged reason. The gate only checks review files exist — rigor comes from fusion being harsh plus a human in the loop, not from any machine quality check.
---

# pb-adversarial-review

复杂任务的规划契约（`prd.md` / `design.md` / `implement.md`）决定实施 agent 的幻觉率。契约越严谨，实施幻觉越少、产出质量越高。本 skill 把契约打磨成**分层 fusion 打磨**：**prd / design / implement 每一层都走 初稿 → fusion 挑刺 → 改成终稿**，用跨厂商 fusion 逐层压实契约。

**这是流程/纪律，不是机器门禁。** 严谨性由两件事保证：**fusion 挑得狠 + 人在场把关**。门禁只验"审查文件存在"，不验、也验不了语义质量——机器能查的结构，LLM 都能秒生成"格式合规的废话"绕过（三家 fusion 跨厂商已实证）。所以这里**不做任何机器质量校验**（不哈希、不实质校验、不验顺序、不验跨轮引用真伪）。诚实标注这一点，别把"文件在"包装成"审查有质量"。

本 skill 是索引。只加载当前工作需要的 reference 文件，不要全部预读。

## 触发条件

- 复杂任务（存在 `design.md`）规划期：每写完一层初稿（prd / design / implement），准备定稿前
- `task.py start` 被 playbook 门禁拒绝，提示缺少某层 review 文件
- 用户要求"审一下 / review / 挑刺"

轻量任务（仅 `prd.md`）不强制分层打磨，门禁天然豁免；用户主动要求时同样适用本流程。

## 三层 fusion 打磨（核心）

prd / design / implement **各自独立走一轮** 初稿 → fusion 挑刺 → 终稿。三层顺序（prd 先于 design 先于 implement）是**提示词级推荐，不是机器门禁**——事后无法验证顺序，靠自觉。

每层统一四步（详见 `references/round-protocol.md`）：

1. **写初稿**：先显式列出本层的**关键不变量 / 假设**（否则 fusion 只能猜，猜错就空转）。模板见 `references/draft-template.md`。
2. **自证事实**：prd 层核对需求与真实约束 / brainstorm / 既有代码一致；design / implement 层 grep 实证。证据引用必须落到 **代码路径:行号 / 用户原话 / brainstorm 段落**，不接受"我确认了"。
3. **组上下文包叫 fusion 挑刺 → 逐条走查**：输入 = `被审文档 + 明写的不变量 + 具体证据引用`（不是裸文档，也不喂全代码库——fusion 无代码库上下文是特性，它攻逻辑自洽/内部矛盾/目标-手段错位，不攻事实，事实由作者供）。每条给 ✅ 采纳（改契约）/ ❌ 反驳（附证据）/ ⏳ 存疑。载体见下。
4. **改终稿**：把采纳项折回本层文档。

**为什么分层、不是最后一道**：三件套一次性写完再单道审，太晚——审查方拿成品反推、误读、空转。逐层打磨在每层成本最低时压实契约。

**implement 轮特殊要求（防复读）**：implement 轮只攻 design 未覆盖的**独有项**（执行顺序 / 回滚 / 验证充分性）。为防退化成复制 design 的发现，implement 的挑刺记录**必须显式引用 design 轮发现并标注 采纳 / 反驳 / 独有**。这是"防复读、强制轮次耦合"，不是机器验质量。

## fusion 载体

- **优先 fusion**：跨厂商多家模型**并行**挑刺（如 opus + agnes + minimax），**主会话当 arbiter** 融合各家、逐条走查。跨模型家族盲区互补，覆盖面最大。
- **逐模型并行调用 + 主会话融合**，**不依赖 llm-consortium 自动 arbiter**（编排层会挂死）。先各发一句 smoke 探活剔除死模型；超时给足（≥240s）。实操见 `references/fusion-howto.md`。
- **禁同会话自审**：同上下文 = 同盲区，不构成对抗。
- **降级留痕**：fusion 单家族 / 探活失败 / 不可用时，降级为 fresh-context sub-agent，并在挑刺记录写明"实际跨几族、降级几次、原因"。静默降级违规。

一键可跑（降低"真做"的成本，让造假无意义）。

## 挑刺记录（给人看的过程留痕）

每层产出一份挑刺记录，写在任务目录：`prd-review.md` / `design-review.md` / `implement-review.md`。共享骨架 + 逐条决议格式见 `references/review-record-template.md`。

这些是**给人看的过程留痕**，不是给机器校验的门禁凭证。门禁只验它们存在 + 非空 + 含 `review-level` 行 + ≥1 决议标记，**不验内容质量**。

**迁移兼容（grandfather）**：旧单轮体系建的任务用单份 `spec-review.md`。门禁规则：`spec-review.md` 存在 → 整个 start-gate 视为满足（旧任务不追溯三份）。新任务不产 `spec-review.md`（产 prd/design/implement-review 三份），自然受三份约束。这条迁移逻辑在 `pb_gate.py`，本 skill 只负责产出三份新记录。

## Route By Intent

| 意图 | 读 |
|---|---|
| 每层四步怎么走（初稿→自证→挑刺→终稿） | `references/round-protocol.md` |
| 一键跑跨厂商 fusion 的实操（并行调用 / 探活 / 降级留痕） | `references/fusion-howto.md` |
| 写每层初稿（不变量区 + 证据自证区） | `references/draft-template.md` |
| 写 / 校验三份挑刺记录 | `references/review-record-template.md` |
| 构造 opposition brief、找各层攻击维度 | `references/attack-checklist.md` |
| 项目要建交付纪律 spec（Gerrit 类工作流示例） | `references/delivery-gerrit-example.md` |

## Not For

- 代码 diff 审查（走上游 check）
- 轻量任务的例行放行（门禁已豁免，无需伪造记录文件）
- 用一轮"看起来不错"的确认代替对抗——一问一答是 review，不是对抗审查
- 靠机器验证审查质量——机器验不了（三家 fusion 实证），质量靠 fusion 狠 + 人把关
