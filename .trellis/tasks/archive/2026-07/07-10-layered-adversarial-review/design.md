# Design — 分层 fusion 打磨行为契约（终稿·地板门禁 + skill 驱动）

## 设计依据（a7442d48 实证）

低干预 dogfood a7442d48 证明：**"审查文件必须存在才能 start"的地板门禁 + skill 提示 + 合作型 agent = 自发跑真 fusion 审查**（用户仅"同意/确认"，AI 自发 pb-adversarial-review + fusion-primary + 真 Blocker）。
- 因此：**验存在（地板门禁）足以驱动行为**，无需验质量（验不了也不需要）。
- 三轮 fusion 已否决的"验质量机器机制"（哈希/内容实质校验）全部不做。

## 关键不变量 / 假设

- INV1：地板门禁只验"审查文件存在 + 非空"，**不验内容质量、不验顺序、不验指纹**。
- INV2：现状 check_start_gate 已验单文件 spec-review.md 存在。本改造 = 扩为验三份存在（prd/design/implement-review），design-review 缺失回退认 spec-review（迁移兼容）。这是**存在性扩展**，不是质量机制。
- INV3：审查的"质量"由 skill 提示（两前提 + 上下文包 + 逐条走查）+ 合作型 agent + 人最终把关共同产生，不由门禁保证。诚实标注。
- INV4：common/index.ts 自动发现新模板文件，零注册。
- ASM1：合作型 agent 会认真跑（a7442d48 实证）；惰性/对抗 agent 可沉默跳过——接受为已知边界，靠"init 了这套 = 团队已选择这套纪律"+ 人把关兜底。

## 交付物

### 1. 地板门禁扩展（pb_gate.py，唯一代码改动）

`check_start_gate`（复杂任务）：验三份 review 文件**各自存在 + 非空 + 含 review-level 行 + ≥1 决议标记**（沿用现有单文件的校验风格，只是从 1 份变 3 份）。
- **迁移 grandfather（implement 轮 IB1 坐实）**：若 `spec-review.md` 存在 → 整个 start-gate 视为满足、直接放行。理由：有 spec-review.md = 旧单轮体系建的任务，不追溯要三份；新任务不产 spec-review.md（新流程产 prd/design/implement-review），自然受三份约束。存量未 start 任务因此不被冻结。（新任务手搓 spec-review.md 绕过 = 等同 PB_SKIP，可接受。）
- **不加**：哈希、内容实质校验、跨轮引用校验、轻量客观触发机器判定。
- 拆成 check_prd_review / check_design_review / check_implement_review + 编排（fusion 设计轮 BD6：避免单函数泥球、隔离 rebase）。
- 轻量任务（无 design.md）：整体豁免（现状逻辑不变）。

### 2. skill 改写（pb-adversarial-review，质量的真正来源）

- SKILL.md：三层 fusion 打磨流程（每层 初稿→挑刺→终稿）、D4 载体、逐条走查、**诚实标注"门禁只验存在、质量靠 fusion+人"**。
- references：
  - round-protocol.md：每层四步（写初稿含不变量 → 自证事实 → 叫 fusion 组上下文包挑刺逐条走查 → 改终稿）
  - fusion-howto.md：一键跑跨厂商（**逐模型并行 + 主会话 arbiter**，别用会挂死的 consortium 编排；先探活剔除死的；单家族降级留痕）
  - draft-template.md：初稿模板（关键不变量/假设区 + 证据自证区）
  - review-record-template.md：三份挑刺记录模板（逐条决议；implement 版引用 design 发现防复读）
  - attack-checklist.md：各层攻击维度（沿用）

### 3. workflow.md（唯一上游触点，pb: 标记）

planning breadcrumb 内加：提示"复杂任务每层都叫 fusion 挑一轮再定稿" + 诚实标注"门禁只验审查文件在不在，质量靠 fusion+人把关，顺序靠自觉"。只在块内加行。

## 三层协议（round-protocol）

每层四步：① 写初稿（先列关键不变量/假设）② 自证事实（prd 核对约束/brainstorm/代码；design/implement grep）③ 组上下文包叫跨厂商 fusion → 逐条走查（采纳改契约/反驳附证据/存疑记录）④ 改终稿。
- 层间顺序：提示词级推荐，非门禁。
- implement 轮：只攻 design 未覆盖的独有项（执行顺序/回滚/验证充分性），引用 design 发现标注采纳/反驳/独有（防复读，非机器校验）。

## fusion 载体（fusion-howto，含本会话踩坑）

- 逐模型并行调用（`llm -m <model>` ×3 后台并行）+ 主会话融合；**不依赖 llm-consortium 自动 arbiter**（本会话实测编排层会挂死）。
- 先各发一句 smoke 探活，死的（如 sunjun）剔除。
- 超时给足（≥240s，真审查生成长）。
- 单家族/降级 → 留痕"实际跨几族、降级几次"（minimax m2）。
- 禁同会话自审。

## 触点清单（PRD R6，白名单）

- 代码：pb_gate.py（check_start_gate 单份→三份存在性 + 拆函数）。**不动** task.py/config.yaml 门禁逻辑。
- 文档：pb-adversarial-review/（SKILL + 5 references）；workflow.md planning 块。
- 测试：pb.test.ts 加"三份存在性门禁矩阵 + 迁移回退 + 轻量豁免"用例。

## 已知边界（诚实）

- 门禁只驱动"审查发生"，不保证"审查有质量"——质量靠 skill 提示 + 合作型 agent + 人把关（a7442d48 证明这组合实际有效）。
- 惰性/对抗 agent 可沉默跳过（但 init 这套即团队选择了这套纪律）。
- fusion 单家族时跨家族盲区未覆盖。
- 不覆盖 playbook 测试轮/skill 轮（另立任务）。
