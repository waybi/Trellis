# L2：trellis channel 原生对抗审查

没有 fusion 多模型工具链时的标准降级路径。零额外依赖——只要装了 trellis 就能跑。命令语法与 `trellis-channel` skill 的 Pattern A/C 一致。

## 原理

对抗审查需要**独立视角**。独立性有两个来源：

1. **异构模型**（多 provider）：不同模型的系统性盲区不同，覆盖面最大。
2. **fresh context**（单 provider 补偿）：主会话已被自己的规约"说服"，新 spawn 的 worker 没有沉没成本，配合显式的攻击视角划分，仍能产出有效对抗。

有几个 provider 就用几个；只有一个也不豁免——用 fresh-context 补偿。

## 多 provider：Pattern C parallel reviewers

一个 channel，多个 worker，每个 provider 一个 fresh check worker：

```bash
TASK=.trellis/tasks/<MM-DD-slug>

trellis channel create spec-review-<slug> --by main --task "$TASK" --ephemeral

# 每个可用 provider spawn 一个 reviewer（示例：默认 provider + codex）
trellis channel spawn spec-review-<slug> --agent check \
  --file "$TASK/prd.md" --file "$TASK/design.md" --file "$TASK/implement.md" \
  --as rev-a --timeout 20m

trellis channel spawn spec-review-<slug> --agent check --provider codex \
  --file "$TASK/prd.md" --file "$TASK/design.md" --file "$TASK/implement.md" \
  --as rev-b --timeout 20m

# 发 opposition brief（长文本必须用 --text-file，不要塞 positional 参数）
trellis channel send spec-review-<slug> --as main --to rev-a --text-file /tmp/opposition-brief.md
trellis channel send spec-review-<slug> --as main --to rev-b --text-file /tmp/opposition-brief.md

# 等全部 reviewer 完成（--all = 每个列出的 worker 都要有匹配事件）
trellis channel wait spec-review-<slug> --as main --kind done --from rev-a,rev-b --all --timeout 20m

# 收结论
trellis channel messages spec-review-<slug> --kind message --from rev-a --raw
trellis channel messages spec-review-<slug> --kind message --from rev-b --raw
```

## 单 provider：fresh-context + 视角划分补偿

同 provider spawn 2–3 个 worker，**opposition brief 各不相同**——每个 worker 分配一组攻击维度（从 `attack-checklist.md` 划分），避免产出同质化：

```bash
# worker 1：数据契约 + 作用域视角
trellis channel spawn spec-review-<slug> --agent check \
  --file "$TASK/prd.md" --file "$TASK/design.md" --file "$TASK/implement.md" \
  --as rev-contract --timeout 20m

# worker 2：验收可靠性 + 边界枚举视角
trellis channel spawn spec-review-<slug> --agent check \
  --file "$TASK/prd.md" --file "$TASK/design.md" --file "$TASK/implement.md" \
  --as rev-accept --timeout 20m

# 之后同上：send 各自的 brief → wait --all → messages 收结论
```

单 provider 的该层挑刺记录（`prd-review.md` / `design-review.md` / `implement-review.md`）里如实写 `providers: <provider> x2 (contract / acceptance)`。

## Opposition brief 模板

写入 `/tmp/opposition-brief.md`（或任务目录下临时文件）：

```markdown
# Opposition Brief: 推翻这份规约

你的任务是**推翻**附带的规划文档（prd.md / design.md / implement.md），
不是欣赏它。假设规约里存在会导致实施失败的缺陷，把它们找出来。

要求：
1. 至少提出 N 个具体问题（建议 N ≥ 8），每个问题必须指向规约中的
   具体条目/字段/步骤，给出"为什么会出问题"的推理链。
2. 禁止总体赞扬（"整体设计合理"之类一律不要写）。
3. 禁止 hedging（"可能需要注意"不算问题；要么指出具体缺陷，要么不提）。
4. 按严重度分级：Blocker（实施必然出错）/ Major（大概率返工）/ Minor。
5. 重点攻击维度：<从 attack-checklist.md 摘取分配给该 worker 的维度>
6. 如果规约声称参考了某个先例，核对同构性声明是否可信。

输出格式：每个问题一节，含 [严重度] 问题描述 / 规约位置 / 失败场景 / 建议修法。
```

## 收尾：主会话逐条走查

worker 的产出是**问题清单**，不是决议。主会话必须：

1. 合并去重全部 worker 的问题。
2. 逐条定 ✅ / ❌ / ⏳——`❌` 反驳必须 grep 代码/配置坐实，不许"我觉得不会"。
3. `✅` 项改回规划三件套，形成规约 v2。
4. 按 `review-record-template.md` 写该层挑刺记录（`prd-review.md` / `design-review.md` / `implement-review.md`）。
5. 有 Blocker 级 ✅ 决议时，建议对改后的规约再跑一轮轻量确认。

## 反模式

- 只 spawn 一个 worker 问"这个规约有问题吗"——一问一答是 review，不是对抗。
- worker 提了 20 条，主会话批量回一句"都接受"——决议必须逐条，且 ✅ 要落到规约改动。
- 把 opposition brief 写成"帮我看看有没有问题"——必须是"推翻它"的立场指令。
