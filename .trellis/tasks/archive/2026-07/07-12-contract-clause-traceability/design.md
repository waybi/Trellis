# Design — 行动契约 + 影响面动作锁（终稿·封 fusion 六刀）

## 关键不变量 / 假设

- INV1：**纯 skill/模板层**（draft-template / round-protocol / attack-checklist / review-record-template / SKILL.md）。**不碰 pb_gate.py**。
- INV2：**无机器门禁**。implement 轮 fusion 证明:任何门禁都靠 agent 自打标记触发,而"没意识到是批量改动"正是 bug 根源,门禁对原始 bug 拦截率≈0 且制造伪安全感(见 implement-review IA1)。真杠杆是"grep 前置"逼意识 + fusion/人复查。
- INV3：治"没意识到批量改动"的唯一办法是 **grep 前置**——碰已有的东西无脑先 grep,不靠 agent 自判危险。
- ASM1：grep 前置 + fusion 复查降低"影响面没核对"类 bug,**不消除**;grep 完整性靠 fusion 用变体 pattern 抽查重跑 + 人,机器保证不了。诚实边界。

## 一、grep 前置（DA1+DA4，反转默认，最关键）

**规则**：design 层任何 § 只要碰到"已存在、会被引用的符号/公式/字段/分发分支"，**必须先跑 ≥1 次 grep 看命中数,再决定是否'改命中集'**。

- 命中数少/无扇出 → 普通 §（轻）。
- 命中跨多处/多调用点 → "改命中集"类 §，上动作锁（§三）。
- **声明"非改命中集"或"轻量"的代价 = 附上那次 grep（命中少即证明）。** 这一条同时废掉"自判省事后门"和"轻量豁免后门"——**不再单列轻量豁免**。

判定边界（DA6）：按"**是否在 switch/分发/查找表里加/改分支、是否改一个被继承或多处引用的定义**"判，不按"是否新增"。新增一个与现有交互的分支（如新 action_type）= 改命中集。

## 二、"改命中集"§ 的契约结构（给 fusion+人看，非机器门禁）

design.md 里每条"改命中集"§ 写清影响面（无机器校验，靠 fusion+人核）：

```
### C3 仅 action_type∈{PAY,Delivery_Pay} 的净额 sum 切毛额
grep: grep -rniE 'sum\(\s*\$pay_money(_deliver)?\s*\*\s*0\.7[0]?\s*\)' yamls_template/
      → 命中 60 处，跨 15 个 action_type（原始输出附 review-record）
变体试过: *0.7 / * 0.7 / *0.70 / 跨行
要改(hit-set): action_type ∈ {PAY, Delivery_Pay}
必须保留(preserve-set): Attribute_Revenue_*_PAY / PAY_BLACK / CASH_PAY / ADJUST_PAY / ...
反向 grep: grep -rn 'Attribute_Revenue_Install_PAY' ...（证明保留集不被主 pattern 命中）
保留集断言: it('Attribute_Revenue_Install_PAY 开关开启后公式不变')
```

## 三、影响面三件（DA2 强化 grep 完整性）

"改命中集"§ 必须写：
1. **影响集 = grep 原始输出**（命令+命中行号）+ **pattern 变体清单**（`*0.7` / `* 0.7` / `*0.70` / 跨行…）+ **grep 根目录 + 命中总数**——防窄 grep。
2. **hit-set vs preserve-set** + 一条**反向 grep**（grep preserve-set 符号，证明它们没被主 pattern 命中）。
3. **preserve-set 真实测试**：design 写断言的**关键子串**（公式片段/字段名），implement 落成真实 test，且该子串**字面出现在 assert 里**（DA3 回查）。

## 四、fusion 逐条核对（DA2）

opposition brief 对每条"改命中集"§ 必做：
- 拿 §声明的 hit-set/preserve-set 对照贴出的 grep 原始输出：**声明命中 = grep 实际命中吗?preserve-set 里有没有实际命中主 pattern 的?**
- **至少挑 1 条用作者没声明的等价 pattern 重跑**（如加空格变体），看是否炸出漏网命中。
- 结论写进 design-review。

## 五、无机器门禁（DA5 已否，implement 轮 fusion 裁决）

不加 pb_gate 结构门禁。理由：门禁靠 agent 自打标记触发,而"没意识到是批量改动"正是 bug 根源→不打标记→门禁沉默→拦截率≈0,且制造伪安全感(比不加更危险)。替代=§一 grep 前置(逼意识)+ §四 fusion 复查。

## 六、implement 层断言对账（DA3）

implement-review 强制一条：design 每条 `preserve-test` 声明的关键子串 → 反查 implement 的 `*.test.*`/`*.mocha.*`,**字面出现在 assert 里**;缺失或降级为 `toBeDefined()` 类空断言 = Blocker。

## 七、砍掉（fusion 驳回）

- 三层 § 编号追溯、40 格矩阵（前 prd 轮已砍）。
- **轻量豁免**（DA4，被 grep 前置取代）。
- 按动词分类触发（DA6，改按语义/分发分支）。

## 八、触点清单

| 文件 | 改动 |
|---|---|
| `draft-template.md` | 行动契约 §；"改命中集"§ 的影响面三件（grep 原文+变体 / hit-set·preserve-set / 反向 grep+保留断言）；grep 前置说明。无机器标记 |
| `round-protocol.md` | grep 前置规则 + 判定边界（分发分支）+ 动作锁在 design 写/implement 落 test |
| `attack-checklist.md` | "声明 vs grep 实际"核对 + 变体 pattern 抽查重跑 必做项 |
| `review-record-template.md` | design-review 记核对结论；implement-review 记断言对账 |
| `SKILL.md` | 串起来 + 诚实边界（降低不消除、无门禁、靠 grep 前置+复查）|
| **`pb_gate.py` / `pb.test.ts`** | **不碰**（无机器门禁，DA5 已否）|

## 九、验证（DA7 盲测 + A/B）

- 盲测任务(预先不标注答案的"改命中集"变更)跑新模板;**对照组**:同任务用旧模板,比漏检。
- 承认霍桑效应:盲测证明"能逼出"是上限,不代表高压下必做。

## 已知边界（诚实）

- 降低不消除（INV2）。结构门禁挡整节省略,挡不住浅层合规。
- grep 完整性最终无法机器保证,靠 fusion 抽查 + 人（ASM1）。
