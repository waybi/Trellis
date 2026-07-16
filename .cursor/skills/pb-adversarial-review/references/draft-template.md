# 每层初稿模板

prd / design / implement 三层初稿共用这个骨架。核心是两个**给 fusion 挑刺用**的区块：`## 关键不变量 / 假设` 和 `## 证据自证`。缺这两区，fusion 只能猜意图 → 空转（真实教训：假 Blocker 多半源于初稿没声明假设）。

正文（需求 / 设计 / 执行清单）按本层原有结构写，下面只规定两个必备区。

---

## 通用骨架

```markdown
# <PRD | Design | Implement> — <任务标题>（初稿）

<本层正文：需求 / 技术设计 / 执行步骤，按原有结构>

## 关键不变量 / 假设

<把"如果这条不成立就全错"的前提显式列出，编号，供挑刺记录引用>

- INV1：<不变量——运行/数据/接口上必然成立且被依赖的性质>
- INV2：<...>
- ASM1：<假设——目前相信但未必永真，若破需重审的前提>
- ASM2：<...>

## 证据自证

<作者供事实：每条关键判断附可复核的证据引用。fusion 攻逻辑不攻事实，事实先自证>

- <判断> — 证据：<代码路径:行号 | 用户原话 | brainstorm 段落>
- <判断> — 证据：<...>
```

---

## 各层侧重

### prd 初稿

- 不变量：需求边界、验收口径、范围内/外的硬约束。
- 自证：需求与真实约束 / brainstorm / 既有代码一致——核对用户原话、brainstorm 段落、相关既有实现。
- 例：`ASM1：用户要的是"流程固化"不是"机器门禁" — 证据：用户 2026-07-10 原话「严谨性靠 fusion+人把关，不由机器验证」`

### design 初稿

- 不变量：技术方案的自洽前提、边界隔离、幂等、迁移兼容。
- 自证：grep 实证——先例是否真同构、影响面清单、耦合点、parse/校验点。
- 例：`INV2：FILE_SPEC_REVIEW 只在 pb_gate.py 内用 — 证据：grep 坐实 archive/task.py 不引用`

### implement 初稿

- 不变量：执行顺序依赖、回滚可行性、"行为变更 vs 叠加"的性质。
- 自证：grep 实证——现有测试会不会翻红、常量/引用的真实分布、悬空引用。
- 例：`INV-I2：单份→三份是行为变更、非叠加，现有 pb.test.ts:214-218「单份→pass」用例会翻红 — 证据:grep 坐实`

---

## design 层：行动契约 §（编号约束）

design 初稿的正文主体写成**编号约束 §**——把"这个方案到底要做成什么样、哪些必须成立"落成可判定的条款，供 implement 配测试、fusion 逐条攻：

```markdown
### C1 <可判定的约束标题>
Cn: <一句可判定的约束——能被证实或证伪，不是"尽量/应该">
来源: <需求原话 | 证据 file:line | brainstorm 段落>
```

- 每条给编号（C1 / C2 …），后续挑刺记录可引用。
- `来源:` 必填——把意图钉到需求原话或代码证据上，不接受凭空条款。
- 这是给 fusion+人看的组织结构，**不引入任何机器标记**（不写 `[change-hit-set]` 之类触发标签，门禁不认、也验不了）。

## design 层："改命中集" § 的影响面三件（动作锁）

凡语义上会**改动一批现有对象**的 §（判定边界见 `round-protocol.md`），在契约条款后追加三件，给 fusion+人核对（**无机器校验**）：

1. **影响集 = grep 原始输出**：贴命令 + 命中行号（不是描述），加 **pattern 变体清单**（`*0.7` / `* 0.7` / `*0.70` / 跨行…）+ **grep 根目录** + **命中总数**——防窄 grep 漏命中。
2. **hit-set vs preserve-set**：哪些要改（hit-set）、哪些必须不动（preserve-set），再附**一条反向 grep**——grep preserve-set 的符号，证明它们没被主 pattern 命中。
3. **preserve-set 断言**：写保留集断言的**关键子串**（公式片段 / 字段名），implement 落成真实 test，且该子串**字面出现在 assert 里**（implement-review 会回查，见 `review-record-template.md`）。

### 示例（改命中集 §）

```markdown
### C3 仅 action_type∈{PAY, Delivery_Pay} 的净额 sum 切毛额
Cn: 只对 action_type ∈ {PAY, Delivery_Pay} 把 sum(...*0.7) 改回毛额；其余含此公式的 action_type 一律不动
来源: U1 原话「只 PAY/Delivery_Pay」

grep: grep -rniE 'sum\(\s*\$pay_money(_deliver)?\s*\*\s*0\.7[0]?\s*\)' yamls_template/
      → 命中 60 处，跨 15 个 action_type（原始输出附 design-review）
变体试过: *0.7 / * 0.7 / *0.70 / 跨行
要改(hit-set): action_type ∈ {PAY, Delivery_Pay}
必须保留(preserve-set): Attribute_Revenue_*_PAY / PAY_BLACK / CASH_PAY / ADJUST_PAY / ...
反向 grep: grep -rn 'Attribute_Revenue_Install_PAY' ...（证明保留集不被主 pattern 命中）
保留集断言: it('Attribute_Revenue_Install_PAY 公式不变') 断言里字面含 'sum($pay_money*0.7)'
```

缺任一件，该 § 视为**未完成、交不了**——把"忘核对影响面"从"靠自觉"变成"交不了差"。语义质量仍靠 fusion+人（机器验不了）。

---

## 反例

```markdown
## 关键不变量 / 假设
- 应该没什么特别的假设
## 证据自证
- 我确认过了，没问题
```

"应该 / 我确认过了"不是不变量也不是证据。fusion 拿到这种初稿只能猜，猜错就产假 Blocker。不变量要能被证伪，证据要能被第三方复核。

改命中集 § 的反例：只写"要改的这几个 action_type"，不贴 grep 原始输出、不列 preserve-set、不给反向 grep——等于宣称"我知道影响面"却拿不出证据，正是上次误伤 15 个 action_type 的写法。
