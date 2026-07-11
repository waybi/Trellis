# Implement — 行动契约 + 影响面动作锁（终稿·纯提示词/review 层，无门禁）

分支 my-workflow。延续 pb 隔离分层。**只改 5 个 skill 文档,不碰 pb_gate.py / pb.test.ts / task.py / workflow.md。**

## 关键不变量 / 假设

- INV-I1：纯文档层，改 pb-adversarial-review 的 5 个 skill 文件。零代码/门禁改动。
- INV-I2：无机器校验——真杠杆是 grep 前置(逼意识)+ fusion/人复查。诚实边界:降低不消除。

## Step 1 — round-protocol.md：grep 前置 + 判定边界

- [ ] **grep 前置铁规矩**:design 阶段任何 § 碰到"已存在、会被别处引用的东西"(公式/字段/符号/分发分支),动手改前**必须先跑 ≥1 次 grep 看散布与命中数**,再判是否"改命中集"。不是"觉得危险才 grep",是"碰到就无脑先 grep"——绕开"没意识到危险"的死结。
- [ ] 判定边界(DA6):按"是否在 switch/分发/查找表加改分支、是否改被多处引用的定义"判,不按"是否新增"。新增一个与现有交互的分支(如新 action_type)= 改命中集。
- [ ] 动作锁在 design 写、implement 落 test 的分工说明。

## Step 2 — draft-template.md：行动契约 § + 影响面三件

- [ ] design 层契约主体 = 编号约束 §，每条 `Cn: <可判定约束> + 来源:`。
- [ ] "改命中集"§ 追加影响面三件(见 design §二/§三,给 fusion+人看,无机器验):
  1. grep 原始输出(命令+行号)+ **变体清单**(`*0.7`/`* 0.7`/`*0.70`/跨行)+ 根目录 + 命中总数
  2. 要改(hit-set) vs 必须保留(preserve-set) + **反向 grep**(证保留集不被主 pattern 命中)
  3. 保留集断言(关键子串,implement 落成真实 test)

## Step 3 — attack-checklist.md：fusion 复查项

- [ ] "改命中集"§ 必做:对照贴出的 grep 输出核"声明要改 = 实际命中?保留集有没有其实也命中?"
- [ ] **用作者没声明的等价 pattern 抽查重跑 ≥1 次**(如加空格变体),炸漏网命中。

## Step 4 — review-record-template.md：断言对账

- [ ] design-review 记 fusion 的"声明 vs 实际"核对结论。
- [ ] implement-review 加**断言对账**:design 保留集声明的关键子串(字段名/公式片段)**必须字面出现在真实 test 的 assert 里**;缺失或降级为 `toBeDefined()` 类空断言 = Blocker。

## Step 5 — SKILL.md：串联 + 诚实边界

- [ ] 把 grep 前置 → 影响面三件 → fusion 复查 → 断言对账 串成流程。
- [ ] 诚实边界:**降低"影响面没核对"类 bug,不消除;无机器门禁;靠 grep 前置逼意识 + fusion/人复查,机器保证不了 grep 完整性。**

## Step 6 — 验证：use-gross-pay 回放（非自证）

- [ ] 拿上次真 bug(全局替换误伤 15 个 action_type)在新模板下重走:看 Step1 grep 前置能否逼 AI 在写替换前发现"公式在 15 个 action_type、254 处",从而收窄到白名单。**这是唯一非循环验证**;不用造假 fixture。
- [ ] 可作为交付后独立盲测(A/B 新旧模板),不阻塞本次文档合并。

## Step 7 — 校验 + 提交

- [ ] `pnpm lint && typecheck && test` 全绿(纯文档改动,应无影响;确认 skill 资产发现类测试不因文件增减翻红)。
- [ ] 逻辑单元提交:`feat(pb): 影响面动作锁——grep 前置 + 契约影响面三件 + fusion 复查 + 断言对账(纯提示词层)`。
- [ ] **提交/推送前停,等用户确认。**

## 风险与回滚

| 风险 | 缓解 |
|---|---|
| 纯提示词 = 靠自觉,可能不做 | 已知天花板(无门禁,implement 轮裁定门禁无效);grep 前置把"先查"设成 design 硬步骤,fusion 复查兜;诚实标注不宣传成保证 |
| skill 资产发现测试因新增/删文件翻红 | Step7 先跑;若断言写死文件清单,最小更新 |
| 回滚 | 纯文档,git revert 单元化 |
