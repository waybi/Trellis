# 行动契约 + 影响面动作锁

## Goal

把 fork 分层对抗审查的 **design 层产物**升级为用户 playbook 精髓的"行动契约"(编号约束 §);并给其中"会改动一批现有东西"的那类 §,焊上一道不可跳过的**影响面动作锁**——必须交 grep 原始输出 + 命中/保留清单 + 真实测试,否则该 § 不算写完。契约管组织,动作锁管救命。纯 skill/模板层,不碰 pb_gate。

## Background(为什么,证据)

- **触发**:07-11 use-gross-pay 实战(会话 10f00c24),三层 fusion 过程完美,但实现全局替换 `sum($pay_money*0.7)`,而 U1 明说"只 PAY/Delivery_Pay"。
- **fusion 打穿的误诊(本 PRD 前身被三家一致驳,见 prd-review)**:bug 根因**不是**"文档不够结构化",是"**没人 grep 出影响面 + fusion 降级 2 家**"。证据:`sum($pay_money*0.7)` grep 实测出现在 15+ action_type(PAY 743/Delivery_Pay 135/Attribute_Revenue_*_PAY 254/ADJUST_PAY/PAY_BLACK/CASH_PAY…)。**就算写了编号 §"只 PAY/Delivery_Pay",只要没人 grep 这 15 个,review 照样过**——编号不触发核对。
- **关键区分(本方案立身点)**:"契约写得严谨" ≠ "AI 真去核对了事实"。写 § 和 grep 影响面是两回事。上次 bug 正是"契约意图有、影响面核对无"。
- **契约定位**:行动契约主体在 design 层(= playbook spec-v2)。prd 供意图约束、implement 配测试——但**不做三层编号追溯/矩阵**(fusion 证其过重且可粉饰)。

## 关键不变量 / 假设(fusion 先攻这里)

- INV1:纯 skill/模板层(draft-template / round-protocol / attack-checklist / review-record-template / SKILL.md)。**不改 pb_gate.py**;动作锁的证据是给 fusion+人核的,不进机器门禁。
- INV2:动作锁**不保证语义质量**(机器验不了,已证)。它只保证:"改命中集"类 § 交不出 grep 影响面+保留断言就**写不完、交不了**——把"忘核对影响面"从"靠自觉"变成"交不了差"。其余靠 fusion+人。
- INV3:动作锁触发条件按**语义**判定(是否改动现有命中集),不按表层动词(替换/删除)——否则"新增 Crypto_Pay 与现有交互"这类会漏(fusion BD3)。
- ASM1:证据锁靠"可核性"防粉饰——grep 原始输出能重跑、test ID 能去 tests/ 查存在。这不防"跑了假 grep/写了空测试",但把粉饰成本抬到接近真做,且留可追证据。诚实边界,非漏洞。

## Requirements

- **R1 design 层写行动契约(编号 §)**:每条 `Cn: <可判定约束>` + `来源:`(需求原话/证据 file:line)。这是 playbook spec-v2 的形态。
- **R2【核心】"改命中集"类 § 焊影响面动作锁**:凡语义上会改动一批现有对象的 §,必须带三件:
  1. **影响集 = grep 原始输出**(命令 + 命中行号),非描述;
  2. **命中集 vs 保留集**(哪些改、哪些必须不动);
  3. **保留集的真实测试**(存在于 tests/ 的 test ID,断言保留集未被动)。
  缺任一件,该 § 视为未完成。
- **R3 砍掉过度设计**:不做三层 § 编号追溯、不做 40 格追溯矩阵(fusion BD5:过重致逃逸 + 可粉饰)。prd 只列意图约束(自然语言即可)、implement 只对"改命中集类 §"补齐 R2 三件证据。
- **R4 fusion 逐条审 § + 强制核对动作锁**:opposition brief 对每条"改命中集类 §"必做"声明作用域 vs grep 实际命中"的核对,写进 review-record。
- **R5 只对复杂任务要求,轻量任务豁免**(防逃逸)。
- **R6 平台无关随 init 分发;延续 pb 隔离分层;不碰 pb_gate。**

## Open Questions(design 阶段解决)

- Q1 "改动现有命中集"的语义判定,如何在 skill 里写清让 agent 会自判(给正反例,而非精确算法)。
- Q2 R2 三件证据在 design-review / implement-review 里的确切落位与格式。
- Q3 现有 review 模板(topbi 存量)如何兼容,不冻结旧任务。

## Out of Scope(含 fusion 驳回项)

- 三层 § 编号追溯 / 追溯矩阵(fusion BD2/BD5 驳:可粉饰 + 过重)。
- 按"替换/删除"动词限定动作锁(fusion BD3 驳:应按语义)。
- 改 pb_gate / 加机器门禁验证据(机器验不了质量,已证)。
- 合并文档 / 改三轮结构(方案 A 保留)。
- playbook 测试轮/skill dogfood 轮(另立)。

## Acceptance Criteria

- [ ] draft-template:design 层含"行动契约 §"结构;"改命中集类 §"模板强制 R2 三件(grep 输出 / 命中·保留 / 真实 test ID)。
- [ ] round-protocol:说清"改命中集"语义判定(正反例)+ 动作锁在哪层补齐。
- [ ] attack-checklist / brief:对"改命中集类 §"必做"声明 vs grep 实际"核对。
- [ ] review-record-template:记 R2 三件证据 + fusion 的作用域核对结论。
- [ ] **盲测验证**(非 use-gross-pay 回溯):拿一个预先不标注答案的"改命中集"变更任务跑新模板,看动作锁能否逼出未预设的影响集/保留项(fusion BD6)。
- [ ] 不碰 pb_gate;`pnpm lint && typecheck && test` 全绿。

## Meta:dogfood

本任务用分层对抗审查自己打磨。prd 轮真 fusion(opus+agnes+minimax)已跑,一致驳回前身"契约条款化"的过度设计,收敛到"你的行动契约 + fusion 的影响面动作锁"融合解(见 prd-review)。**注意 fusion BD6:自举 + 已知回溯有循环论证风险,故 AC 用盲测新任务验证,不用 use-gross-pay 自证。**
