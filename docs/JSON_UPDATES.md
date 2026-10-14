# 通用 JSON 更新导入 · 设计提案（未实现）

## 现有能力

`app.importData` 读取完整 v1 账本（最大 5 MB）→ `core.validate` → 用户确认 → 下载当前 JSON 备份 → 整本替换 localStorage → 清空 GitHub store。重复导入同一份整本备份不会 append 重复记录，但它不是增量合并，会丢掉备份之后的新变更。

`core.validate` 已有集合/ID/关联/部分数值及日期校验；`reports.report` 可对候选账本计算分类变化。`GithubStore.read` 获取 JSON 与 SHA，`save` 带 SHA 写回并在冲突时停止。它们可以复用，不需要后端。

现有恢复入口清空 store 后，读取云端又会替换本地。因此“先读取 → 导入整本更新 → 保存”不能安全地更新既有云端文件；不能通过重新测试连接或复制 SHA 绕过这个保护。

取得的应用仓库没有旧旅行 PowerShell 脚本。未审查或迁移其内容，不能断言它们原来使用什么数据结构。

## 建议的最小增量协议

另设“导入更新”入口，保留“恢复完整备份”。批次只携带数据变更，不含 GitHub config/token，不连接网络，不直接发 PUT。每个更新包含集合、稳定 ID、完整 before/after 记录；第一版仅允许新增和更新，不支持删除或自动重写 settings。

以下为**虚构示例、未来协议**，目前不能交给应用的整本导入按钮：

```json
{
  "format": "perk-track-update",
  "formatVersion": 1,
  "baseSha": "fictional-sha-from-latest-read",
  "changes": [
    {
      "collection": "points",
      "id": "fictional-flight-credit-2026-a",
      "before": null,
      "after": {
        "id": "fictional-flight-credit-2026-a",
        "type": "earn",
        "date": "",
        "periodYear": 2026,
        "program": "Aeroplan",
        "amount": 1200,
        "incomeBucket": "flight",
        "affectsBalance": false,
        "notes": "虚构：来源已经包含于余额快照，具体日期未知。"
      }
    }
  ]
}
```

稳定 ID 要来自可复用的业务来源标识，不能每次运行用随机 UUID 或运行时间生成。不同飞行航段、税费、使用记录分别用 ID，不能仅按金额/日期去重；同金额也可能是不同真实事项。修改已有记录需要保留原始归因、备注及兼容字段。

## 应用顺序与冲突规则

1. 用户先导出本地备份并手动读取最新云端 JSON/SHA；若有未同步本地修改，先解决差异，不能直接把旧本地账本当云端基线。
2. 浏览器纯函数在最新账本副本上处理批次，只允许 v1 集合及 `rewardRules`，拒绝重复 change ID、不匹配的 record ID、凭证字段和原型污染键。
3. 按字段语义比较记录（不能依赖 JSON 对象键顺序）。若当前记录已等于 after，标为 no-op；否则当前必须等于 before。`before:null` 表示确认不存在才可新增，同 ID 已存在不同记录则冲突。更新不得隐式覆盖最新备注。
4. 若全批次均为 no-op，不改变本地、不写 GitHub，重复执行成立；否则要求批次 baseSha 匹配最近读到的 SHA。SHA 变化时停止，让用户基于最新数据重新生成/核对 before，不能自动套旧变更。
5. 完整候选一次性通过 `core.validate`；依赖记录可同批新增，最终关联必须有效。失败不产生部分修改。
6. 展示新增/修改/no-op/冲突及收益、余额、费用差异。明确哪些金额是估值，哪些输入未知。用户确认后自动备份，再只保存到 localStorage；保留此次云端读取的 store/SHA。
7. 用户仍点击“保存到 GitHub”。写入必须使用基线 SHA，409 停止；重新读取、比较并重新预览，不能仅换新 SHA 重试旧整本 JSON。网络结果不明时也先核对远端。

无云端的纯本地模式可不要求 baseSha，但必须有相同的 before/after 检查和备份；未绑定到云端读取时不能直接覆盖已有云端文件。

## 必须通过的虚构验收

- 同批次连续应用两次；第二次 no-op，记录数/余额/收益不变。
- 写回后再次读取并重复导入；仍 no-op，即使旧 baseSha 已过时也不会再写。
- 最新云端存在同 ID 不同内容或无关变更导致 SHA 不同；停止并展示冲突，不丢数据。
- 新增一张卡及关联积分，同批验证成功；不存在关联、重复 ID、不合法日期、夹带 token 拒绝且原账本不变。
- 已包含于快照的飞行/刷卡来源 `affectsBalance:false`；收入归类准确、余额不增加。
- 转点本金不算收入，单记 bonus 不重复加点；学费本金不作损失，正常赚点与 SUB 手续费分列。
- 保留原币税费；USD 换算未知时 CPP 为空。Status 重叠使用保留单条归因。
- 读写 SHA、401/403/404/409、网络失败、保存期间本地编辑均不覆盖更新或丢本地修改。

先实现/测试纯合并函数，再加差异预览与现有手动保存衔接。不要继续新增“一次旅行一个脚本”，也不要为导入引入服务端。
