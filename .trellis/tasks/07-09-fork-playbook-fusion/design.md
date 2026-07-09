# Design: Fork Trellis 融合 playbook 工作流

## 0. 设计总纲：三层隔离模型（D9）

一切设计围绕一个目标：**上游 rebase 时冲突面趋近于零**。

```
┌─ L0 上游区（绝不触碰）────────────────────────────────────┐
│  packages/core/**  configurators/**  extract.ts           │
│  common/index.ts（自动发现，无需注册）                       │
│  brainstorm.md / check.md / update-spec.md 等上游 skill 正文 │
├─ L1 fork 新增文件区（零冲突，承载全部内容）─────────────────┤
│  templates/common/bundled-skills/pb-adversarial-review/    │
│  templates/common/bundled-skills/pb-harvest/               │
│  templates/common/skills/pb-find-precedent.md              │
│  templates/trellis/scripts/common/pb_gate.py               │
│  packages/cli/test/templates/pb.test.ts                    │
├─ L2 触点区（上游文件最小插入，只放指针，带 pb: 标记）────────┤
│  ① task.py cmd_start        +3 行（import + 门禁调用）      │
│  ② task_store.py cmd_archive +3 行（门禁调用）              │
│  ③ config.yaml              文件末尾追加 playbook 节        │
│  ④ workflow.md              4 处 ≤3 行的指针式插入          │
└────────────────────────────────────────────────────────────┘
```

**分层纪律：**
- 内容（流程、清单、模板、决策树）**只能**放 L1；L2 只放"指向 L1 的一句话 + 一次函数调用"
- 所有 L1 资产用 `pb-`/`pb_` 前缀命名——上游永远不会创建同名文件，rebase 零改名冲突
- 每个 L2 插入用注释标记包裹（Python `# pb:gate` / Markdown `<!-- pb:begin -->…<!-- pb:end -->`），rebase 冲突时按标记快速定位重放
- L2 插入位置选"锚点稳定"处：函数体第一行之后、文件末尾、breadcrumb 块内部行尾追加

### 冲突面预算（rebase 时的预期）

| 文件 | 插入量 | 冲突概率 | 冲突时处理 |
|---|---|---|---|
| L1 全部新文件 | — | ~0 | 无 |
| task.py / task_store.py | 各 3 行 | 低（函数头稳定） | 按 pb: 标记重放 |
| trellis/index.ts | +4 行（pb_gate.py 注册） | 低（注册表追加式） | 按 pb: 标记重放。实施中发现：trellis/scripts 是显式注册制非自动发现，此为必要的第 5 触点 |
| configurators/shared.ts | +3 行（SKILL_DESCRIPTIONS 注册 pb-find-precedent） | 低（map 追加式） | 实施中发现：单文件 skill 的 description 必须注册（frontmatter 生成硬校验），第 6 触点 |
| test/configurators/platforms.test.ts | +5 行（BUNDLED_SKILL_NAMES 补 pb 条目 + gemini 前缀断言加 pb-） | 低 | 清单断言补齐，implement.md 风险表预期内 |
| test/templates/trellis.test.ts | it.skip + 注释（marketplace 镜像测试） | 低 | **已知分叉**：fork 的 workflow.md 有意偏离上游 marketplace 镜像（pb 指针），镜像在 mindfold-ai 子模块内无法更新。skip 并注明原因 |
| config.yaml | 尾部追加 | ~0（append-only） | 无脑保留两侧 |
| workflow.md | 4×3 行 | **中**（上游高频改此文件） | 按 pb: 标记重放；这是唯一需人工判断的文件 |

---

## 1. L1 组件设计

### 1.1 `pb_gate.py` — 门禁模块（D1/D4/D8）

位置：`templates/trellis/scripts/common/pb_gate.py`（随 init 落到用户仓库 `.trellis/scripts/common/`）

```python
# 纯函数 + 两个入口，全部逻辑自包含
def is_complex_task(task_dir: Path) -> bool          # design.md 存在 = 复杂任务
def gates_enabled(repo_root) -> bool                  # 读 config.yaml playbook.gates，默认 True
                                                      # 复用 common.config._load_config（import，不改上游）
def check_start_gate(task_dir, repo_root) -> str|None
    # 复杂任务 && 门禁开 时要求 task_dir/spec-review.md：
    #   - 存在且非空
    #   - 含 `review-level: L1|L2` 声明行
    #   - 含至少一条决议标记（✅/❌/⏳ 或 "- [x]"）
    # 返回 None=通过；str=拒绝原因（含修复指引：跑 pb-adversarial-review）
def check_archive_gate(task_dir, repo_root) -> str|None
    # 复杂任务 && 门禁开 时要求 task_dir/harvest.md 存在且含分拣结论
    # （"无收获"也是合法结论，但必须显式写出——诚实原则）
```

要点：
- **验证据不验工具**（D8）：不感知 fusion/channel 是否安装
- 豁免逻辑集中在 `is_complex_task` + `gates_enabled` 两个纯函数，轻量任务/关开关天然放行
- 逃生舱：环境变量 `PB_SKIP_GATE=1`（紧急放行，打印黄色警告留痕），不加 CLI flag（避免改 argparse，缩小 L2）
- 上游对应物：无（全新模块）。上游 hooks 非阻塞，已确认不可用作硬门禁

### 1.2 `pb-adversarial-review/` — 对抗审查 bundled skill（D1/D8/D6/D2）

```
pb-adversarial-review/
├── SKILL.md                     # 触发条件 + L1/L2 选择决策树 + 证据文件格式契约
└── references/
    ├── evidence-format.md       # spec-review.md 模板：review-level 头 + 逐条决议区
    ├── l2-channel-review.md     # trellis channel 对抗流程：Pattern C spawn N 个
    │                            #   fresh worker + opposition brief 模板 + wait --all
    ├── attack-checklist.md      # 从 playbook 反模式表提炼的攻击清单
    │                            #   （token 边界/作用域/验收可靠性/parse 校验/幂等…）
    └── delivery-gerrit-example.md  # D2 的 Gerrit spec 示例，供项目抄到
                                    #   .trellis/spec/guides/delivery.md
```

- L1（fusion）路径只写"若本机有 fusion 工具链则优先使用"，不依赖其存在
- 证据格式是**契约**：pb_gate.py 校验的字段与 evidence-format.md 一一对应，两处同步维护

### 1.3 `pb-harvest/` — 回顾收获 bundled skill（D7）

```
pb-harvest/
├── SKILL.md                     # 分拣决策树：学到了什么 → 4 类去处 + 无收获显式宣告
└── references/
    ├── harvest-format.md        # harvest.md 模板（archive 门禁契约）
    ├── skill-extraction.md      # 程序性知识→skill 判据（同类 ≥2 次）+ 提炼骨架
    └── precedent-report.md      # 实现报告骨架（先例资产，喂 D6 飞轮）
```

- 定位为 Phase 3.3 的**扩展**而非替代：SKILL.md 指引"先跑上游 trellis-update-spec 沉淀 spec，再按决策树分拣其余类型"——不改 update-spec.md 正文

### 1.4 `pb-find-precedent.md` — 找先例 skill（D6）

单文件 skill（自动发现）。内容：三路降级流程 + 同构核对清单（防"找错先例照错抄"）+ de-novo 宣告写法。产出去向：prd.md 技术备注 + spec-review.md 证据区。

### 1.5 `pb.test.ts` — fork 自有测试

独立测试文件（不改上游测试）：
- 断言 3 个 pb 资产被 `getSkillTemplates()`/`getBundledSkillTemplates()` 发现
- pb_gate.py 行为：用 execa 跑 python 单测（复杂/轻量 × 有/无证据 × 开关 的组合矩阵）
- config.yaml 含 playbook 节

## 2. L2 触点设计（全部改动清单）

### ① task.py `cmd_start`（+3 行）

```python
def cmd_start(args):
    repo_root = get_repo_root()
    ...full_path 解析后...
    # pb:gate — playbook 规约对抗审查门禁（见 common/pb_gate.py）
    from common.pb_gate import check_start_gate
    if (reason := check_start_gate(full_path, repo_root)): print(colored(reason, Colors.RED)); return 1
```

插在 task_dir 解析成功之后、status 翻转之前。**两条执行路径（正常/degraded）都在此之前拦截**，一处插入覆盖全部。

### ② task_store.py `cmd_archive`（+3 行）

同构：resolve 成功后、归档动作前，调 `check_archive_gate`。

### ③ config.yaml（尾部追加）

```yaml
#-------------------------------------------------------------------------------
# Playbook Gates (fork: waybi/Trellis my-workflow)
#-------------------------------------------------------------------------------
# pb:begin
playbook:
  gates: true    # 复杂任务的 spec-review / harvest 硬门禁；false 则全部放行
# pb:end
```

### ④ workflow.md（4 处指针插入，每处 ≤3 行）

| 位置 | 插入内容（指针，非内容） |
|---|---|
| `[workflow-state:planning]` 块内追加 | "复杂任务：`task.py start` 前需 `spec-review.md`（对抗审查证据，load `pb-adversarial-review`）；找先例 load `pb-find-precedent`（三路输出，de-novo 须显式宣告）" |
| `[workflow-state:in_progress]` 块内 Flow 行 | flow 尾部插 `pb-harvest`：`… -> trellis-update-spec -> pb-harvest -> commit`；追加一行 "若 `.trellis/spec/guides/delivery.md` 存在，commit/push 必须遵守" |
| Phase 1.4 步骤体 | 追加门禁说明一行（复杂任务证据要求 + PB_SKIP_GATE 逃生舱） |
| Phase 3.3 步骤体 | 追加 harvest 一行（分拣沉淀 + archive 门禁） |

`planning-inline` / `in_progress-inline` 两个 Codex 块同步加同样的行（同一批插入统计在 4 处内，按块计为同位置）。

## 3. 数据契约

### spec-review.md（start 门禁契约）

```markdown
review-level: L1 | L2          ← pb_gate 校验此行
providers: claude, codex        ← L2 时记录实际用了几个
## 决议
- ✅/❌/⏳ <问题> — <决议 + 证据>   ← 至少一条
```

### harvest.md（archive 门禁契约）

```markdown
## 分拣
- skill / lore-or-spec / precedent / memory / none: <条目或"无">
```

两个契约的完整模板在对应 bundled skill 的 references/ 里，pb_gate.py 只做最小结构校验（存在 + 关键行 + 非空），不做语义校验——语义质量由 skill 流程保证。

## 4. 兼容与上游不变量

- 上游三不变量全部保持：triage/consent 不动；artifact 分级被门禁**复用**（is_complex_task 即上游"有 design.md = 复杂"的判据）；3.4 commit 可达（harvest 插在 update-spec 与 commit 之间，不阻断链路）
- 未 init pb 资产的旧项目：`trellis update` 会分发新文件；config 无 playbook 节时 `gates_enabled` 默认 True——但 pb_gate 模块不存在的旧 `.trellis/scripts` 里 task.py 也是旧版，无 import，天然兼容
- degraded 模式（无 session identity）：门禁照常生效（插入点在分叉之前）

## 5. 运维：上游同步 SOP（D5）

```bash
git fetch upstream && git switch main && git merge --ff-only upstream/main
git switch my-workflow && git rebase main
# 冲突时：搜 "pb:" 标记，重放指针插入；L1 文件永不冲突
pnpm build && pnpm test && npm i -g ./packages/cli
```

回滚：任何门禁误伤 → config `playbook.gates: false` 立即全局放行（不用回滚代码）。

## 6. 已否决的替代方案

- lifecycle hooks 做门禁：上游 hooks 非阻塞，做不成硬门禁（已验证）
- config 结构化 delivery 配置：无代码消费即伪配置（D2）
- 人工评审降级：不现实（用户否决，D8 改为 channel 原生）
- 改 brainstorm/check/update-spec 正文：冲突面大，改为新增 skill + 指针（D9）
