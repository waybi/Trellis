# PRD 轮对抗审查（真 fusion 版，替代早先降级自审）

review-level: L1（真跨家族 fusion）
l1-available: yes — 手动并行调用（llm-consortium 编排层本会话挂死，改为逐模型并行 + 主会话当 arbiter）
mechanism: 3× 独立模型并行（runai-claude-opus-4-8 / agnes-2.0-flash / runai-minimax-m3），主会话融合。sunjun-qwen3.6-35b 死(40s 挂)已剔除。
date: 2026-07-10
inputs: prd.md 终稿
raw: /tmp/fx-prd-{opus,agnes,minimax}.md

## Arbiter 融合结论

三家高度收敛,砍中早先降级轮（同会话自审 / 同家族 sub-agent）全部漏掉的**根本缺陷**。

## 逐条决议（按共识强度）

### ✅[接受·Blocker·三家一致] BF1 门禁"结构合规"≠"审查有效"，是它自己诊断的同一种防伪剧场
- opus B1/B2 + agnes 1/3 + minimax B2 三家独立命中。PRD 在 Background 痛斥"审得晚/空转/防伪剧场",但开的药(哈希一致性门禁 + 纯存在性 AC)是**同一类**:哈希只证"审后未改",证不了"审过";AC 全是"有文件/结构合规",测不了"是否真消除偏差"。作者写完终稿→补哈希→填一句 LGTM 即可过关,空转原样复现。
- **决议**:① 哈希宣称诚实降级为**只承诺"防陈旧(审后未再改)"**,不再宣称防伪/保证螺旋;② 增结构化字段让门禁能做**最小逻辑校验**(而非纯存在):每份 review 必含 `identified_risks` / `resolutions`(且 resolution 必须逐条回应 risk)/ 具名发现≥N 条,空 review 或纯 LGTM 判不合规(agnes 3 + opus B2)。

### ✅[接受·Blocker·三家一致] BF2 轻量任务判据 = "作者没写 design.md" = 可逆用的后门
- opus M4 + agnes 2 + minimax B4。作者只要不写 design.md 就自动豁免最高价值的 design 全量对抗轮。
- **决议**:轻量判定改为**客观触发**(无 code change / 变更文件数 < 阈值 / 非核心路径),判定逻辑 skill 提示词硬编码,不由 agent 自填 design.md 有无决定。存储位置(如 init 写 mode 标记)在 design 定。

### ✅[接受·Blocker] BF3 AC 全是存在性/结构性，无一测"是否真消除偏差"
- opus B2 + agnes 3 + minimax B1/m4。AC 全绿 ≠ 目标达成。
- **决议**:补**效果类 AC**——每份 review ≥N 条具名发现(问题+定位+处置);用本任务自身 dogfood(prd 轮已跑出这份 fusion review)作验收基线。AC 拆分为"交付物 AC"与"运行时/门禁行为 AC"两组(minimax m4)。

### ✅[接受·Blocker] BF4 非对称加权 R3 与 AC3 自相矛盾
- opus M1 + minimax B3。R3 说"门禁判不了轻重",AC3 说"权重可核查"——核查主体悬空。
- **决议**:拆两段——机器可核查的(权重字段必在 + 是合法枚举值)入门禁;"理由行"诚实声明为人工/事后审计项,机器不验理由质量。

### ✅[接受·Major] MF1 prd 层"证据自证"被"未必是 grep"稀释到无法验证
- opus M2 + minimax M3。口子开太大,"我核对了一致"=没核。
- **决议**:prd 层证据自证必须落到可核查引用三选一:① brainstorm 段落/section ID ② 既有代码路径:行号 ③ 用户原话/已确认外部文档。三类外不接受"我确认了"。

### ✅[接受·Major] MF2 pb_gate.py 改动 vs "只改模板/最小化 rebase" 边界矛盾
- opus M3 + minimax M2。门禁拒绝逻辑必然改 pb_gate.py 代码,与 Out-of-Scope"只改模板交付物"张力。
- **决议**:明确 pb_gate.py 在改动范围内,以独立补丁形式交付;列出触及文件白名单证明收敛;AC5 从"可 git diff"(工程态度、非判据)改为"diff 落在白名单路径前缀 + 行数 ≤ N"(minimax M4)。

### ✅[接受·Major] MF3 fresh-context sub-agent 的产物契约/上下文注入全未定义
- agnes 4 + minimax M1。谁 spawn、上下文哪来、产物落哪个路径、门禁读哪个文件、是否会被跳过——PRD 只字未提。轻量 sub-agent 缺上下文则"对抗"是无的放矢的噪音。
- **决议**:design 定义 prd 轮产物路径 + 生成方式 + 注入的上下文包(需求摘要 + 相关代码片段 + 已知约束)。

### ✅[接受·Major] MF4 implement 轮与 design 轮重叠仲裁未定
- opus m1 + minimax M5 + agnes 6。
- **决议**:列 implement 轮**独有**查项(执行顺序/回滚/验证充分性),重叠项归 design,implement 不复审。

### ✅[接受·Major] MF5 审查僵局无降级/超时
- agnes 7。螺旋可能死循环。**决议**:定最大迭代次数 + 升级路径(僵局上报人)。

### ✅[接受·Major] MF6 Q2 证据形态未决却被下游多处依赖 → 前移到 PRD 冻结
- 三家一致。**决议**:PRD 阶段冻结 = **三份独立文件 + 共享 frontmatter 骨架契约**(minimax m1 + agnes 推单文件,取三家折中:三文件但共享骨架,便于哈希归属 + 原子提交)。

### ⏳[记录·最重] BF0 "螺旋"名不副实——放弃时序=放弃 playbook 精髓
- minimax 偏差总结 + opus m2。Q1 裁决承认门禁不保证顺序,等于放弃"螺旋"的时间维度,只剩"每层被审过"的静态切片。playbook 精髓"早期错误早期消灭"的保证**来自时序,不在终态**。
- **决议(需用户定)**:二选一——① **诚实降级宣称**:不再叫"螺旋",改称"分层证据完整性 + 防陈旧校验",承认是打折实现;② **补时序锚**:git commit 时间 + review 文件 mtime 早于下游终稿写入时间,作辅助证据(有攻击面,需明列残留风险)。

## 总结
真 fusion 一轮打出 1 个根本 Blocker(BF1:药=病) + 5 个 Blocker/近 Blocker + 6 个 Major,且三家跨厂商独立收敛,可信度高。**这些是降级轮(同会话/同家族)系统性看不到的**——正是用户坚持要真 fusion 的价值实证。PRD 需据此大改;BF0 时序问题需用户拍板方向。
