# PRD 轮对抗审查(真 fusion)

review-level: L1
mechanism: 3× 并行(runai-claude-opus-4-8 / agnes-2.0-flash / runai-minimax-m3),主会话 arbiter
degrade-note: 首批全超时(疑似残留 llm 进程堵塞),pkill 清理 + 单发探活恢复后重跑成功。opus/minimax 已收敛,agnes 未读(收敛已足)。
date: 2026-07-12
inputs: prd.md 初稿 + INV1-3/ASM1 + 证据(action_type 分布 grep)

## Arbiter 结论:PRD 误诊了根因,整个"契约条款化"框架被证伪,只剩 blast-radius 有救

opus + minimax 各自独立、几乎逐条一致。

## 逐条决议

### ✅[接受·Blocker·两家一致] BD1 误诊根因:不是"叙述 vs 编号",是"没人 grep + fusion 降级"
- 就算 draft 里写了编号 `C3: 只 PAY/Delivery_Pay`,只要没人去 grep 那 15 个 action_type,review 照样过——编号不会自动触发 blast-radius 检查。**AC5 自己露馅**:救 bug 的是"带 **blast-radius** 的 §",不是"编号"。把 blast-radius 抽出来,整份 PRD 因果论证就塌。
- **裁决**:承认误诊。编号 §/三层追溯/矩阵不是根因解药。

### ✅[接受·Blocker·两家一致] BD2 追溯矩阵"空格现形"依赖 agent 诚实留空 = 把哨兵交给小偷
- 矩阵 agent 自填,它能每行硬填一个牵强的实现/测试把格子填满(如"test_pay 通过"但没断言其他 action_type 不变)。全绿但 bug 仍在。**与原 bug 同源**(agent 能产出"过程对、实质错")。ASM1"只声称可见性"失效:40 行全绿矩阵里一个粉饰格子比散文里一条漏约束**更难发现**,结构化可能反而降低可见性。
- **裁决**:接受。矩阵机制对无意识遗漏有效,对有意识粉饰零防御。

### ✅[接受·Blocker·两家一致] BD3 blast-radius 是唯一真强制项,且被 Q2 错误限定
- 全文唯一"带强制动作、真能救 bug"的是 blast-radius(强制 grep 出现集 + 命中/保留)。但 Q2 把它限定为"替换/删除类"——**用症状(表层动词)定义解药**。反例:新增 Crypto_Pay 支持不算替换/删除,却同样是"影响集未核对",同类 bug 会复发。
- **裁决**:blast-radius 一般化为"**任何修改现有命中集的改动 → 强制列影响集**",按语义不按动词。

### ✅[接受·Major·两家一致] BD4 机器可验的证据锚,不能只靠人眼
- blast-radius 的"命中集"必须**粘 grep 原始输出(命令+行号)**,不是描述;测试引用必须指向 `tests/` 下真实存在的 test ID(如 `it('PAY_BLACK unaffected')`)可被 CI/人解析。否则又是可粉饰的描述。

### ✅[接受·Major·两家一致] BD5 三层 § 追溯负担 → 重演"过重→PB_SKIP 逃逸"
- 一份中等改动(10 约束)= prd 10 意图 § + design 10 实现 § + implement 10 测试 § + 30 次回指 + 10×4 矩阵。上一轮 fusion 已批"三层过重致逃逸",这版直接加结构负担却没量化、没豁免、没负担上限。Q1(跨层编号)悬而未决就进 Requirements = 设计债当需求交付。

### ✅[接受·Major·两家一致] BD6 Meta dogfood + AC5 是循环论证
- 用未验证的模板验证它自己;且"给 fork 加模板"天然结构化无隐藏 scope,和"给 BI 加公式开关(15 个隐藏 action_type)"是不同难度类别,自证成功零外推。use-gross-pay 是已知答案的回溯,任何事后诸葛(含旧散文模板)都能满足 AC5,不可证伪。
- **裁决**:验证必须用**盲测**——一个未发生的、形态类似的新任务(如 BI 下一批 action_type 扩展),对照新旧模板漏检率。

## 最小可行反提案(两家一致收敛到几乎同一句)

**砍掉编号 §、三层追溯、追溯矩阵。只做一条**:
> **"影响面强制清单"**——任何修改现有命中集的改动(替换/删除/schema 迁移/批量更新/新增与现有交互的类型),必须在 review 前列出:① 影响集的 grep 原始输出(命令+行号)② 声明的命中集 vs 保留集 ③ 覆盖保留集的测试断言(真实 test ID)。作为 **attack-checklist 的必答项**:reviewer 不填此项,review 不算完成。fusion 对每条必做"声明作用域 vs 实际 grep 命中"的核对并写进 review-record。

用**盲测新任务**验证,不用 use-gross-pay 回归。

## 需用户拍板(勿自动重写)

fusion 直接否定了"契约条款化"这个出发点——但那是**你 playbook 精髓("行动契约")的映射**。二者张力需你定:
- 甲:听 fusion,砍成"影响面强制清单"一条(小、可执行、直击这次 bug 类)。
- 乙:保留编号 § 契约(你看重的 playbook 精髓),但必须回应 BD1/BD2/BD5(编号不是根因、矩阵可粉饰、三层过重)——否则是"结构化词汇包装的旧散文"。
