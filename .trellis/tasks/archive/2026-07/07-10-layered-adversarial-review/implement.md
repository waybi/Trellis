# Implement — 分层 fusion 打磨改造执行清单（初稿）

分支 my-workflow（基线含 031de028）。延续 pb 隔离分层。

## 关键不变量 / 假设（对抗先攻；implement 轮已 grep 坐实）

- INV-I1：**代码改动 = pb_gate.py + pb.test.ts；行为相关文档 = SKILL.md(含 frontmatter description，影响路由)/workflow.md**（IB3 纠正"唯一代码改动"误导）。不动 task.py/task_store.py/config.yaml 门禁逻辑。
- INV-I2：从单份→三份是**行为变更、非叠加**：现有 pb.test.ts 断言"单份 spec-review→pass"的用例会翻红（grep 坐实 :214-218 等），必须**改写**不是只"加"（IB2）。
- INV-I3：skill references 自动发现只覆盖新增；**删/并文件会改计数、留悬空引用**（evidence-format 被 3 处引用，grep 坐实）——需同步（IM2）。
- INV-I4：**grep 坐实 FILE_SPEC_REVIEW 只在 pb_gate.py 内用，archive/task.py 不引用 → 拆函数无耦合，安全**（IM1）。
- ASM-I1：三份存在性门禁不显著抬高 PB_SKIP（a7442d48 单份 + 低干预自发跑真 fusion 实证；三份是存在性扩展、非质量军备）；且 grandfather 规则使存量不被卡，进一步降低逃逸诱因。仍需 topbi 实测观察。

## Step 1 — pb_gate.py：单份→三份存在性 + grandfather

- [ ] 常量 FILE_PRD_REVIEW/FILE_DESIGN_REVIEW/FILE_IMPLEMENT_REVIEW；保留 FILE_SPEC_REVIEW
- [ ] **grandfather（IB1，首查）**：check_start_gate 开头——若 spec-review.md 存在 → 直接放行（旧任务不追溯三份）
- [ ] 否则拆 check_prd_review / check_design_review / check_implement_review（各：存在+非空+review-level 行+决议标记，沿用现有单份逻辑），编排三者 AND
- [ ] **不加**哈希/实质校验/跨轮引用校验；is_complex_task/gates_enabled/archive 门禁/逃逸阀不动
- 验证：python 冒烟——① 复杂+三份齐→过 ② 复杂缺任一份（且无 spec-review）→拒（报缺哪份）③ 轻量→豁免 ④ **只有旧 spec-review→grandfather 过** ⑤ 三份+spec-review 并存→grandfather 优先过

## Step 2 — pb-adversarial-review skill 改写三层

- [ ] SKILL.md：三层流程 + D4 载体 + 逐条走查 + 诚实标注"门禁只验存在、质量靠 fusion+人"
- [ ] references：round-protocol.md（四步）、fusion-howto.md（逐模型并行+arbiter，别用 consortium 编排；探活；每批前清残留 llm 进程；降级留痕；禁同会话自审）、draft-template.md（不变量区+证据自证区）、review-record-template.md（三份；implement 版引用 design 发现）、attack-checklist.md（沿用/补各层侧重）
- [ ] evidence-format.md → 重构为 review-record-template；**同步更新 3 处引用（grep 坐实：l2-channel-review.md:93、SKILL.md:58、SKILL.md:72）**（IM2），避免悬空
- [ ] SKILL frontmatter description 更新

## Step 3 — workflow.md（唯一上游触点）

- [ ] planning 块加：每层叫 fusion 提示 + "门禁只验存在、质量靠 fusion+人、顺序靠自觉"诚实标注（块内加行，不动标签，pb: 标记）

## Step 4 — pb.test.ts

- [ ] **先改写现有 start-gate 用例**（IB2，grep 坐实 :214-218 等"单份→pass"会翻红）：单份 spec-review 的用例改为体现 grandfather 语义（spec-review 存在→pass）
- [ ] 新增：三份齐→过 / 缺任一份（无 spec-review）→拒 / grandfather（只 spec-review）→过 / 三份+spec 并存→grandfather 过 / 轻量豁免
- [ ] skill references 计数/存在性断言更新（evidence-format 重构后计数变化；注明"仅验文件在，不构成执行保证"）
- [ ] pnpm lint && typecheck && test 全绿

## Step 5 — E2E（含 update 路径，Im3）

- [ ] pnpm build && npm i -g ./packages/cli
- [ ] init 路径：临时 repo trellis init → 三个 review 模板就位、pb_gate 验三份、workflow 含三层提示
- [ ] **update 路径（关键，Im3）**：模拟存量任务（只有 spec-review.md、无 prd/implement-review）升级后 start → **grandfather 放行**（不冻结）
- [ ] 门禁实测：复杂缺 implement-review（无 spec）→拒；补齐→过；轻量→无感；旧 spec-review→grandfather 过

## Step 6 — 提交（按逻辑单元，吃狗粮）

- [ ] feat(pb): start 门禁单份→三份存在性校验 + 拆函数
- [ ] feat(pb): pb-adversarial-review 改写三层 fusion 打磨 + 模板
- [ ] feat(pb): workflow 三层 breadcrumb
- [ ] test(pb): 三份门禁矩阵
- [ ] **提交/推送前停下等用户确认**（push 不可逆）

## Step 7 — topbi 传播（fork 提交后另做）

- [ ] topbi trellis update -s + aweskill 归位（按 memory SOP）

## 风险与回滚

| 风险 | 缓解 |
|---|---|
| 三份存在门禁抬高 PB_SKIP（design 轮 BD5） | 存在性门槛低、摩擦小 + grandfather 使存量不被卡；topbi 观察 SKIP 频率，过高则整体回退单份语义（非摘一道，Im1） |
| workflow.md 改动破坏 breadcrumb 解析 | 只块内加行；先 diff 加行后切片仍正确（Im2）；pb.test.ts breadcrumb 正则用例兜底 |
| **迁移：存量只有 spec-review 的未 start 任务被三份 AND 冻结（IB1）** | **grandfather：spec-review 存在则整体放行**；E2E 补 update 路径验证 |
| 回滚（四维，IM3） | ① 代码 revert pb_gate/pb.test ② init 产物模板 ③ 已分发项目本地模板/workflow 反向传播 ④ skill description 路由摇摆；grandfather 已大幅降低需回退概率；playbook.gates:false 一键关兜底 |
