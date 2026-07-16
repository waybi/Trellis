# fusion 实操：一键跑跨厂商对抗审查

目标：让"每层叫 fusion 挑一轮"成本足够低，低到造假（伪造一份挑刺记录）比真跑还费劲。核心是**逐模型并行调用 + 主会话融合**，不依赖会挂死的编排层。

---

## 为什么不用 llm-consortium 自动 arbiter

实测：`llm-consortium` 的自动 arbiter 编排层**会挂死**（多模型往返 + 自动融合时卡住不返回）。所以：

- **逐模型并行调用**：`llm -m <model>` 各起一个后台进程，同时发同一份上下文包。
- **主会话当 arbiter**：三家返回后，由主会话（你）读全部原始输出、去重、逐条走查。不把融合交给工具。

## 标准跑法

```bash
# 0) 每批调用前先清残留 llm 进程，避免上一批卡住的进程堵塞本批
pkill -f 'llm -m' 2>/dev/null; sleep 1

# 1) smoke 探活：各发一句，剔除死的模型（如某家临时不可用）
for m in opus agnes minimax; do
  echo "ping" | llm -m "$m" >/tmp/smoke-$m.txt 2>&1 &
done
wait
# 人工看 /tmp/smoke-*.txt：空/报错的模型这轮剔除，并在挑刺记录留痕

# 2) 组上下文包（被审文档 + 不变量 + 证据引用）到一个文件
cat > /tmp/fx-context.md <<'EOF'
<opposition brief：推翻这份文档，见 attack-checklist.md>

--- 被审文档（本层初稿）---
<prd/design/implement 初稿全文>

--- 关键不变量 / 假设 ---
<INV1 ... / ASM1 ...>

--- 证据自证 ---
<代码路径:行号 / 用户原话 / brainstorm 段落>
EOF

# 3) 逐模型并行挑刺（超时给足：真审查生成长，≥240s；--no-log 见下"避免挂死"）
for m in opus agnes minimax; do
  ( timeout 300 llm -m "$m" --no-log < /tmp/fx-context.md > /tmp/fx-$m.md 2>&1 ) &
done
wait

# 4) 主会话读 /tmp/fx-*.md，去重 + 逐条走查（arbiter），写 <layer>-review.md
```

## 避免挂死（重要，根因已查证）

并行发多个长 prompt 时,若整批 0 输出挂到超时、但单发 smoke 秒回,**不是模型慢,是 `llm` 的 SQLite 写锁竞争**:llm 默认把每次请求写 `logs.db`,并行多个同时写 + 上一批超时留下的孤儿进程持锁 → "database is locked" → 后续全阻塞到超时。根治:
- **每次调用带 `--no-log`(`-n`)**——不写日志=无并发写锁竞争(上面命令已加)。
- 或全局一次 `llm logs off`。代价:`llm logs` 查不到历史;但结论写在挑刺记录里,不靠 llm 历史库,零损失。
- 加大 timeout **没用**(是死锁不是慢)。

## 关键纪律

- **每批前 `pkill -f 'llm -m'`**：上一批若有卡住的孤儿进程会持锁堵塞本批,先清(治标,配合 --no-log 治本)。
- **先探活再挑刺**：死模型不剔除会拖垮整批 / 污染融合。剔除结果写进挑刺记录。
- **超时 ≥240s**：真对抗审查输出长，超时太短会截断成半截结论。
- **禁同会话自审**：同上下文 = 同盲区。挑刺模型必须是主会话之外的独立模型。

## 降级路径与留痕

优先级：跨厂商多家 fusion > 单家族 fusion > fresh-context sub-agent。任何降级都**必须在挑刺记录留痕**：

```
review-level: L1（真跨家族）| L1-degraded（单家族，跨家族盲区未覆盖）| L2（fresh-context sub-agent）
mechanism: 3× 并行（opus / agnes / minimax），主会话 arbiter
degrade-note: sunjun 探活失败已剔除；实际跨 2 族（opus / minimax m2）
```

- **单家族降级**：只剩一个模型家族可用 → `review-level: L1-degraded`，写明"跨家族盲区未覆盖"。
- **fusion 全不可用**：降级为 fresh-context sub-agent（平台原生 Task/Agent 工具，spawn ≥2 个独立上下文 reviewer，各分配不同攻击视角），`review-level: L2`，写明降级原因。
- 静默降级（不写原因就换载体）= 违规。

## 反模式

- 用 `llm-consortium` 自动 arbiter 跑 → 编排层挂死。用逐模型并行 + 主会话融合。
- 不探活直接批量发 → 死模型拖垮整批。
- 超时设 30s → 结论被截断。
- 同会话自己审自己 → 同盲区，等于没审。
- 降级了但记录里仍写 `L1`（真跨家族）→ 谎报，违规。
