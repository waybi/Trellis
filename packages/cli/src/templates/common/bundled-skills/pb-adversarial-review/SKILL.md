---
name: pb-adversarial-review
description: Adversarial review of planning artifacts (prd/design/implement) for complex tasks before task.py start. Produces the spec-review.md evidence file required by the playbook start gate. Two-level fallback - L1 multi-model fusion toolchain (must detect availability first), L2 fresh-context reviewers via trellis channel or platform-native sub-agents.
---

# pb-adversarial-review

规约质量决定实施 agent 的幻觉率。复杂任务的规划三件套（`prd.md` / `design.md` / `implement.md`）在进入 Execute 之前，必须经过一轮**对抗审查**（adversarial review）——让独立视角尝试推翻规约，把盲区在实施前暴露出来，并把逐条决议落成证据文件 `spec-review.md`。

单一视角（哪怕很仔细）有系统性盲区：token 边界误伤、作用域隔离、不可靠验收标准、缺失的 parse 校验……这些问题在规约期修复成本极低，在实施后修复成本极高。

本 skill 是索引。只加载当前工作需要的 reference 文件，不要全部预读。

## 触发条件

- 复杂任务（存在 `design.md`）的规划三件套成稿，准备 `task.py start` 之前
- `task.py start` 被 playbook 门禁拒绝，提示缺少 `spec-review.md`
- 用户要求"审一下规约 / review the spec / 挑刺"

轻量任务（仅 `prd.md`）不强制对抗审查，门禁天然豁免；但用户主动要求时同样适用本流程。

## L1 / L2 选择决策树

**第 0 步（必做，不可跳过）：检测 L1 可用性。** 检查你的可用 skill / 命令列表里是否有 `fusion`（或用户声明的等价多模型评审工具），把结果如实记入证据文件的 `l1-available:` 行。不检测就直接选 L2 属于**静默降级，违规**。

```
可用 skill 列表里有 fusion（或等价多模型评审工具）？
├── 有 → 必须走 L1：用 fusion 对规划三件套跑多模型对抗审查
│         （异构模型并行挑刺，跨模型家族盲区互补，覆盖面最大）
│         确需降级（fusion 探活失败 / 超时 / 中途挂）
│           → 允许转 L2，但必须在证据文件写明降级原因
└── 没有 → L2：fresh-context 对抗审查（人人可用，零额外依赖）
          载体二选一，证据文件必须如实写实际用的哪种：
          ├── trellis channel：Pattern C parallel reviewers，
          │   每个 provider spawn 一个 fresh check worker 并行对抗
          │   （见 references/l2-channel-review.md）
          └── 平台原生 sub-agent（如 Claude Code 的 Task/Agent 工具）：
              spawn ≥2 个 fresh-context 评审 agent，
              各分配不同攻击视角 + opposition brief
```

L2 的本质要求是**独立上下文 + 对抗指令 + 视角划分**——channel 和平台原生 sub-agent 都是合格载体；同会话自审不是。

规则：

- **降级合规，静默跳过违规。** L1 不可用就走 L2，但"不可用"必须是第 0 步检测过的事实，不是默认假设；连 L2 都不可用才允许人工逐条走查——但同样必须产出 `spec-review.md`。任何情况下不允许"我看着没问题"直接 start。
- **门禁验证据不验工具。** `pb_gate.py` 只检查 `spec-review.md` 的结构，不感知你用了什么工具。证据文件如实声明 `review-level`、`l1-available` 和实际载体即可。
- 审查对象是规约本身（prd/design/implement），不是代码。代码审查走上游 check 流程。

## 证据文件契约（摘要）

审查完成后在任务目录写 `spec-review.md`，门禁校验以下最小结构：

1. 文件存在且非空
2. 含 `review-level: L1` 或 `review-level: L2` 声明行
3. 含至少一条决议标记（`✅` / `❌` / `⏳` 或 `- [x]`）

完整模板见 `references/evidence-format.md`。语义质量（问题是否真被逐条走查）由本 skill 流程保证，门禁只做结构校验。

## 标准流程

1. 确认规划三件套成稿（对抗审查的输入是"可被评审的对象"，不是脑子里的想法）。
2. 按决策树选 L1 或 L2，发起对抗审查。opposition brief 必须要求"推翻这份规约"，禁止总体赞扬。攻击维度参考 `references/attack-checklist.md`。
3. 收集全部问题后**逐条走查**：每条给出 ✅ 接受（改规约）/ ❌ 反驳（附证据，grep 坐实，不拍脑袋）/ ⏳ 待验证。不批量囫囵。
4. 把决议合并回规划三件套（规约 v2），写 `spec-review.md` 存证。
5. 重大改动（有 Blocker 级决议）建议再跑一轮收敛确认。

## Route By Intent

| 意图 | 读 |
|---|---|
| 写 / 校验 `spec-review.md` 证据文件 | `references/evidence-format.md` |
| L2：用 trellis channel 跑对抗审查（单/多 provider） | `references/l2-channel-review.md` |
| 构造 opposition brief、找攻击维度 | `references/attack-checklist.md` |
| 项目要建交付纪律 spec（Gerrit 类工作流示例） | `references/delivery-gerrit-example.md` |

## Not For

- 代码 diff 审查（走上游 check / trellis-channel Pattern B）
- 轻量任务的例行放行（门禁已豁免，无需伪造证据文件）
- 用一轮"看起来不错"的确认代替对抗——一问一答是 review，不是对抗审查
