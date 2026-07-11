# Harvest — 影响面动作锁

## 分拣

- **skill/流程沉淀**：pb-adversarial-review 加"影响面动作锁"——grep 前置 + 影响面三件 + fusion 变体复查 + 断言对账(交付物本身)。
- **坑/反模式(已入 memory)**：
  - **门禁靠 agent 自打标记触发 = 对原始 bug 拦截率≈0**：因为"没意识到是批量改动"正是 bug 根源,它不会打标记;门禁只抓"打了标记但字段缺"(非失败模式),且制造伪安全感,比不加更危险。→ 治"没意识到"只能靠 grep 前置(无脑先查)+ 复查,门禁替代不了。
  - **fusion 反复剥过度设计**:三轮把"契约条款化+编号§+追溯矩阵+结构门禁"剥到"grep 前置+复查",纯提示词层。已存 `feedback_fusion_strips_overdesign.md`。
- **memory(跨会话)**:`feedback_fusion_strips_overdesign.md` 已建(先找承重强制动作,别先搭结构;门禁=存在地板非质量验证)。
- **先例资产**:本 task 的 prd/design/implement + 三份 fusion review,是"如何用 fusion 逐层剥掉过度设计、如何在门禁与提示词间诚实取舍"的完整先例。
- **无收获项**:无。

## 完成边界(诚实)

- 5 个 skill 文档改完;lint/typecheck/test(1345)全绿;零 pb_gate/代码改动。
- **未提交前状态**:见 git commit。**未 push**(待用户)。
- **未做**:use-gross-pay 回放验证(Step6,列为交付后独立盲测,不阻塞文档合并——诚实标注:本次交付未经有效性实测,只经三轮 fusion 设计评审)。
- 诚实定位:降低"影响面没核对"类 bug,不消除;无机器保证。
