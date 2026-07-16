# 交付纪律 spec 示例：Gerrit 工作流

> **这是示例，不是通用规则。** 本文件展示"项目级交付纪律 spec"长什么样，供使用
> Gerrit 的项目抄到自己的 `.trellis/spec/guides/delivery.md` 并按需修改。
> 用 GitHub PR / GitLab MR 的项目应写自己的版本（分支命名、PR 粒度、review 规则等）。
>
> 约定：若 `.trellis/spec/guides/delivery.md` 存在，commit/push 环节**必须**遵守它。
> 文件不存在则只需遵守通用 commit 纪律（按逻辑单元拆分、前缀规范）。

---

以下为可抄写的示例正文：

```markdown
# Delivery: Gerrit 工作流交付纪律

## 持续交付节奏

**每个交付节点都要 push 一次，不是最后一次性。** 代码、文档、测试、
工具脚本、评审反馈后的修正——每一步独立产出都要独立 commit + push
`refs/for/<branch>`。一个完整任务通常产生 5–8 个 change。

push 完不是结束：等 review + 准备推下一个 change。

## Gerrit 特有的三个坑

1. **merge commit 会被拒。** 每个 change 必须是干净的单 commit。需要同步
   分支时用 `git reset --hard` + `git cherry-pick` 拉平，不用 `git merge`。
2. **cherry-pick 产生新 change-id。** 同一份代码进不同目标分支（如 master
   和 beta）会得到不同的 change 号——这是正常现象，不是 bug。
3. **禁止 `git add -f` 强推 gitignored 文件。** 想让被忽略的路径进 git，
   精准修改 `.gitignore` 白名单（反选规则），不硬闯。

## Commit 边界纪律

- 按**逻辑独立单元**拆 commit，不是按"是否已 stage"拆。
- 前缀严格：`feat(...)` / `fix(...)` / `docs(...)` / `test(...)` /
  `build(...)` / `chore(...)`。
- Subject 短（< 50 字符）；body 讲 why，不复述 what。
- Co-Authored-By trailer 按项目约定添加。

## 清理纪律

- 发现工作区有同功能的历史半成品：确认新产出是完整超集后清理，仓库回到 clean。
- 生成类脚本污染工作区的，跑完必须显式 `git checkout <列出的文件>` +
  `rm <列出的未追踪文件>`，不许留脏。
- **未验收、未合并、未提交 = 任务没有真正完成。** 断点如实标注。
```
