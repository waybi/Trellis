# Harvest: fork-playbook-fusion

诚实声明：本任务无 `spec-review.md`——对抗审查门禁正是本任务的交付物，任务启动时机制尚不存在；规约实际经历了用户 4 轮实时纠偏（fusion 定位、L3 否决、隔离分层、命名），不以事后伪造证据的方式补票。

## 分拣

- skill: 无（pb-* skill 是交付物本身，非过程提炼；同类 fork 操作尚未发生第 2 次）
- lore-or-spec: 上游扩展点两种模式——common/skills 与 bundled-skills 为目录自动发现（零注册），trellis/scripts 与单文件 skill description 为显式注册制（trellis/index.ts getAllScripts、shared.ts SKILL_DESCRIPTIONS，漏注册即硬失败）。已落 design.md 冲突面预算表
- precedent: 本任务 design.md（三层隔离模型 + 触点预算表）+ implement.md 即"fork 上游活跃项目"的先例资产；下次同类需求（fork 定制其他工具）可照抄结构
- memory: fork 维护要点存入 auto memory（rebase SOP、6+2 触点清单、marketplace 镜像已知分叉、单文件 skill 安装名带 trellis- 前缀）

## 关键教训（供下次 fork 类任务）

1. 勘察阶段要区分"自动发现"与"注册制"扩展点——预算表初版漏了 2 个注册点，都是跑测试才暴露
2. 子模块携带的镜像一致性测试是 fork 的天然分叉点，显式 skip + 注明比归一化比较 hack 更诚实
3. 平台安装名 ≠ 模板文件名（trellis- 前缀），所有"load X"指令必须用安装名
