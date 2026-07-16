---
name: pb-harvest
description: Post-task harvest triage - sort what was learned into skills, spec guidelines, precedent library, or memory before archiving. Produces the harvest.md evidence file required by the playbook archive gate. Complements trellis-update-spec, does not replace it.
---

# pb-harvest

任务完成不等于交付结束。**回顾收获（harvest）**是一等环节：把这次任务学到的东西分拣沉淀到正确的去处，才能让"个人经验"变成"团队/项目资产"。任何一次沉淀断掉，下次同类需求就得重来。

本 skill 是上游 `trellis-update-spec` 的**补充，不是替代**：update-spec 负责把行为契约沉淀进 spec；本 skill 负责分拣其余类型的收获（程序性知识、先例资产、跨会话决策），并产出 archive 门禁要求的证据文件 `harvest.md`。

## 触发条件

- 任务实施与验收完成，`trellis-update-spec` 已跑完之后、`task.py archive` 之前
- `task.py archive` 被 playbook 门禁拒绝，提示缺少 `harvest.md`
- 用户要求"复盘 / 沉淀一下 / harvest"

轻量任务（仅 `prd.md`）门禁豁免，但有明显收获时仍建议跑一遍。

## 标准流程

1. **先跑上游 `trellis-update-spec`**：行为契约、DO/DON'T、错误矩阵类内容沉淀进 `.trellis/spec/`。这一步不由本 skill 承担。
2. 回顾本任务全程（规划决议、实施过程、踩过的坑、被纠正的方向），对每条收获走下面的分拣决策树。
3. 按 `references/harvest-format.md` 写 `<task-dir>/harvest.md` 存证。
4. 继续 commit / archive。

## 分拣决策树

对每条"这次学到了什么"，问它是什么类型：

```
这条收获是……
├── 可复用的操作流程（怎么做一类事）？
│     → 程序性知识：满足判据（同类操作 ≥2 次）则提炼成 skill
│       判据与提炼骨架见 references/skill-extraction.md
├── 坑 / 反模式 / 行为契约（什么不能做、边界在哪）？
│     → lore 或 spec guidelines：小教训记项目 lore/notes；
│       构成行为契约的走 trellis-update-spec 进 .trellis/spec/
├── 本任务的结构性产物（实现报告、决议文档、可照抄的改动结构）？
│     → 先例资产：按 references/precedent-report.md 写实现报告，
│       归入项目先例库（喂 trellis-pb-find-precedent 的飞轮——先例库随任务自增长）
├── 影响后续会话的决策 / 偏好 / 环境事实？
│     → memory：写入平台的跨会话记忆机制
└── 都不是？
      → 无收获：在 harvest.md 里显式宣告"无"。
        显式宣告是合法结论；静默跳过 harvest 才违规（诚实原则）。
```

同一条收获可以多去处（例：一个坑既进 spec 又值得一条 memory），但每个去处都要真的落文件，不许只在 harvest.md 里"声称已沉淀"。

## 证据文件契约（摘要）

`harvest.md` 是 `task.py archive` 门禁（`pb_gate.py:check_archive_gate`）的校验对象：文件存在、非空、含 `## 分拣` 节。分拣结论的完整性（每类一行条目或"无"）由本流程保证，门禁只做结构校验。完整模板见 `references/harvest-format.md`。

## Route By Intent

| 意图 | 读 |
|---|---|
| 写 / 校验 `harvest.md` 证据文件 | `references/harvest-format.md` |
| 判断某流程值不值得提炼成 skill、怎么提炼 | `references/skill-extraction.md` |
| 写实现报告（先例资产） | `references/precedent-report.md` |

## Not For

- 替代 `trellis-update-spec`（spec 沉淀仍走上游流程，本 skill 在其后运行）
- 任务中途的进度记录（那是 journal / session 的职责）
- 为过门禁写一行"无"敷衍——"无收获"必须是回顾之后的诚实结论，不是跳过回顾的借口
