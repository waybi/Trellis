# IMPLEMENT 轮对抗审查(真 fusion)

review-level: L1
mechanism: 3× 并行(opus / agnes / minimax),主会话 arbiter
degrade-note: 首批全超时(残留 llm 进程),pkill 重跑成功。opus/minimax 收敛,agnes 未读。
date: 2026-07-12
inputs: implement.md 初稿

## Arbiter 结论:DA5 结构门禁对原始 bug 拦截率 ≈ 0,是"装饰",别建

opus + minimax 逐条一致,且直指我上一轮劝用户加的结构门禁。

## 逐条决议

### ✅[接受·Blocker·两家一致] IA1 门禁靠 agent 自打标记触发 = 把触发权交回被约束者
- 门禁扫 `[change-hit-set]` 标记,标记是 agent 自己打的。上次 use-gross-pay 的 bug 正是"agent 没意识到这是批量改动、不打标记"→ 门禁扫不到 → 放行 → 事故复现。**门禁只能抓"打了标记但字段缺",而那从来不是失败模式。** 对原始 bug 拦截率 ≈ 0,与纯提示词等价,甚至更危险(伪安全感)。
- **裁决**:结构门禁(DA5)对本 task 的目标 bug 无效。**不建这道门禁**(或重命名为"字段完整性检查",明确它不拦 bug 本体,避免误导)。

### ✅[接受·Blocker·两家一致] IA2 盲测踢到 follow-up = 交付未验证有效性的东西
- Step3/4 只验"字段缺会不会拒"(报警器按钮会响),没验"着火会不会响"。且"循环论证"辩护说反了——造个缺字段 fixture 看它拒,才是循环;盲测(旧 bug 重放看漏检)才是唯一非循环验证。
- **裁决**:合并前必须至少做一例**回放实验**(拿 use-gross-pay 真实 bug 在新模板下重走,看是否仍不打标记/仍全局替换)。

### ✅[接受·Major·两家一致] IA3 字段名三处定义必漂移 / IA4 markdown 块解析脆
- 字段名在 pb_gate/template/test 三处独立,无单一真源 → 改名即静默失效。markdown 块边界(缩进/tab/代码围栏内举例/中文冒号/多块)是 mini-parser 非 grep,"逻辑浅"是幻觉。
- (若真建门禁才需修:单一常量源 + 结构化语法如 HTML 注释/YAML 子段 + 单一 canonical fixture 从模板派生。但见 IA1,门禁本身该砍。)

### ✅[接受·Minor] IA5 无诚实拦截率估计
- 真实拦截率 ≈ P(agent 打标记) × P(grep 写全),不是"结构性保证"。三类 bug:(a)标了缺字段→拦;(b)标了但 grep 窄/断言浅→放行;(c)根本不标→放行。**原始 bug 落在 (c),门禁拦不住。**

## 重新定位(诚实)

本 task 真正有价值、且非门禁的部分,是**提示词/review 级**的:
- **grep 前置**(round-protocol):碰已有的东西先 grep 再判——这才是治"没意识到是批量改动"的东西,但它是提示词级。
- **反向 grep 保留集 + 保留集断言对账**(attack-checklist / implement-review):让"不该动的"被显式证明未动。
- **fusion 用作者没声明的变体 pattern 抽查重跑**:治窄 grep。

门禁(DA5)不是承重墙,是装饰墙——与 memory `feedback_fusion_strips_overdesign` 记录的模式第三次吻合。

## 需用户拍板(勿自动编码门禁)

- **甲(推荐)**:**砍掉 DA5 门禁**(不碰 pb_gate),只落"grep 前置 + 反向 grep + 断言对账 + 变体抽查"这些提示词/review 改动,并用 **use-gross-pay 回放**验证有效性。诚实定位:靠 prompt 纪律 + fusion 抽查降低 bug,不靠门禁。
- **乙**:仍建门禁,但改**启发式触发**(扫批量动词关键词强制要求块)——fuzzy、误报多、仍可绕,复杂度上升。两家都提了但都不看好。
- **丙**:到此收——洞察(门禁是装饰、真杠杆是 grep 前置+review)已拿到,记 lore 即止,不编码。
