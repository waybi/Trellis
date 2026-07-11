# 分层 fusion 打磨行为契约 prd/design/implement

## Goal

把 fork 的规划流程固化成:**prd / design / implement 每一层都"初稿 → fusion 挑刺 → 改成终稿"**,用 fusion 逐层把行为契约打磨到高度严谨,让实现 agent 照着写不产生幻觉。

**这是"流程/纪律",不是"机器门禁"。** fork 负责把"每步该叫 fusion 挑一轮、初稿该怎么写才好挑"固化进 skill/workflow/模板;**严谨性由 fusion 挑得狠 + 人在场把关来保证,不由机器验证。**(原因见 Background:机器验不了审查质量。)

## Background

- 需求源头:playbook 的行动契约(spec-v2)靠 fusion 对抗"压实",消除实现 agent 的幻觉。契约越严谨,幻觉越少、产出质量越高。
- 现状问题:Trellis 把 playbook"起草→挨打→重写"的分层打磨,拉直成"三件套一次性写完 → 最后单道审查"。太晚——审查方拿成品反推、误读、空转(topbi 实验:3 个 Blocker 有 2 个是误读)。
- **本任务自身 dogfood 的关键教训**:规划本任务时,我一度想加"机器门禁"自动验证"审查是否认真做过"(哈希、内容实质校验)。用真 fusion(opus+agnes+minimax 三家跨厂商)审这个设计,**三家独立一致证伪**:任何机器能查的结构,LLM 都能秒生成"格式合规的废话"绕过——**机器判不了语义质量**。这与"顺序不可门禁化"同源。故本方案**放弃一切机器质量门禁**,回到"流程固化 + fusion 挑刺 + 人把关"。
  - 反证:正是这轮 fusion 挑刺拦住了我把错误设计写成代码——**证明"分层 fusion 挑刺"这个动作本身有效**,这正是要固化的东西。

## Decisions（已与用户收敛，2026-07-10）

- **D1 三层各一轮 fusion 打磨**:prd/design/implement 各自 初稿 → fusion 挑刺 → 逐条走查(采纳/反驳,反驳须附证据) → 改成终稿。目的是压实契约,不是过关卡。
- **D2 每轮两个前提**(让 fusion 挑得准,实验证明有效):
  - ① 初稿必须**显式声明本层关键不变量/假设**——否则 fusion 只能猜,猜错就空转(topbi 2 个假 Blocker 的成因)。
  - ② 事实先**自证**再交 fusion——prd 层核对需求与真实约束/brainstorm/既有代码一致;design/implement 层 grep 实证。高价值事实缺口往往作者自证时就发现(早于 fusion)。
- **D3 评审上下文包**:fusion 无代码库上下文——**这是特性**:它擅长攻逻辑自洽/内部矛盾/目标-手段错位,不擅长对事实。分工=作者供事实(D2 两前提)、fusion 攻逻辑。每轮输入 = `被审文档 + 明写的不变量 + 具体证据引用(代码路径:行号 / 用户原话 / brainstorm 段落)`,不是裸文档,也不喂全代码库。
- **D4 fusion 载体**:多家跨厂商并行(如 opus+agnes+minimax),主会话当 arbiter 融合三家、逐条走查。禁同会话自审(同上下文同盲区)。fusion 单家族/不可用时降级为 fresh-context sub-agent,并**留痕说明降级**。一键可跑(降低"真做"成本,让造假无意义)。
- **D5 严谨性来源 = fusion 狠 + 人把关,不是机器门禁**:机器验不了语义质量(三家 fusion 已证)。fork 只固化"流程 + 模板 + 提示",不加"卡住不让过 / 验证审查真伪"的机器门禁。是否认真做,由人把关——这是对"机器验不了质量"的正确应对,不是缺陷。
- **D6 implement 轮引用上游发现防复读**:implement 轮聚焦 design 未覆盖的独有项(执行顺序/回滚/验证充分性);为防退化成复制 design 的发现,implement 的挑刺**显式引用 design 轮发现并标注采纳/反驳/独有**。定位是"防复读、强制轮次耦合",不吹成"机器验质量"。
- **D7 只做规划期这三轮**:playbook 的另两轮(测试完成前对抗、skill 发布前 dogfood)另立独立任务,本任务不含、不声称已实现 playbook 全部三轮。

## Requirements

- R1 fork 把"prd/design/implement 每层 初稿→fusion 挑刺→终稿"固化进 skill + workflow:提示 AI 在每层该叫 fusion、按 D4 载体跑、逐条走查。
- R2 每层初稿模板含:**关键不变量/假设**显式区 + **证据自证**区(引用落到 代码路径:行号 / 用户原话 / brainstorm 段落,不接受"我确认了")。
- R3 每轮 fusion 输入按 D3 组装成上下文包。
- R4 每轮产出一份挑刺记录(prd-review / design-review / implement-review),记逐条决议(采纳/反驳+证据);implement-review 须引用 design 轮发现(D6)。**这些是给人看的过程留痕,不是给机器校验的门禁凭证。**
- R5 **不新增机器质量门禁**:不改 pb_gate 去做哈希/实质校验/三文件强制/轻量客观触发(全部已证伪或被否)。现有 pb start-gate(要求 spec-review.md 存在)作为"是否做过审查"的最低地板,保持原样、不扩。
- R6 全部平台无关,随 init 分发;改动收敛(主要是 skill/workflow/模板),最小化上游 rebase 冲突,延续 pb 隔离分层。

## Out of Scope（均已否决/证伪）

- 机器质量门禁:哈希防伪/防陈旧、内容实质校验、三文件强制门禁、轻量任务客观触发——**机器验不了语义质量(三家 fusion 实证),不做**。
- "螺旋 [门禁强制]"命名与顺序门禁化(顺序事后不可验证)。
- 合并成单一密契约(方案 B)。
- playbook 测试轮 / skill dogfood 轮(另立任务)。
- 改 core 包 / configurators;fork 运行时升级到 0.6.6。

## Acceptance Criteria

交付物:
- [ ] skill(pb-adversarial-review 或新 skill)清晰描述三层 fusion 打磨流程:每层 初稿→挑刺→终稿、D4 载体、逐条走查。
- [ ] 三层初稿模板含"关键不变量/假设"区 + "证据自证"区;三份挑刺记录模板含逐条决议,implement-review 含对 design 发现的引用。
- [ ] workflow 在 planning 阶段提示"每层都要叫 fusion 挑一轮再定稿",并诚实标注"严谨性靠 fusion+人把关,不靠机器验证"。
- [ ] 不改 pb_gate 的门禁逻辑(R5);改动随 init 分发到各平台。
- [ ] `pnpm lint && typecheck && test` 全绿。

效果(用本任务自身 dogfood 作示范,非机器验收):
- [ ] 本任务 prd/design 两轮真 fusion 已跑并留痕(prd-review.md / design-review.md),证明该流程能挑出人和单模型看不见的洞(design 轮推翻了错误的"机器门禁"方向即为实证)。

## Meta：本任务 dogfood

本任务自己走这套分层 fusion 打磨(fork 运行时 0.6.2 无门禁,手动跑):
- prd 轮、design 轮均用**真 fusion**(opus+agnes+minimax 三家跨厂商并行,主会话 arbiter)跑过,记录在 prd-review.md / design-review.md。
- design 轮的价值实证:它一致证伪了我自己加戏的"机器质量门禁",把方案拉回"流程固化 + fusion + 人把关"这个正确且简单的形态。
- 早先用同会话/同家族 sub-agent 的降级轮已作废。
