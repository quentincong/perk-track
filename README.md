# Perk Track

个人信用卡、银行开户奖励及积分看板。应用使用纯 HTML / CSS / JavaScript，独立于 ChatGPT 运行，无框架、构建步骤、后端、AI API 或第三方数据库。金额以 USD 税前口径计算；原币种税费另行保留。

## 仓库与发布边界

- 应用仓库：[quentincong/perk-track](https://github.com/quentincong/perk-track)，目前公开。用户计划以后取得 GitHub Pro 再改为 private；维护者不得自行修改权限或发布方式。
- 应用地址：[GitHub Pages](https://quentincong.github.io/perk-track/)。2026-10-14 只读核实配置为 `Deploy from a branch`，`main` / `/ (root)`，有 `.nojekyll`。
- 用户指定账本为独立私有仓库 `quentincong/perk-track-data` 的 `data.json`。本轮未访问真实账本。
- 个人账本、token、账户信息、真实数据的 HTML / JSON / CSV / 备份不得提交到应用仓库。`.gitignore` 只是防误操作，不能代替审查提交内容。

本次接手时本地目录为空，代码从应用仓库克隆。原 README 提到的 `Perk-Track.html`、`tests/` 和 npm 配置并未入库；没有迁移这些不存在的文件或旧旅行脚本。本轮补入了测试和开发脚本。当前入口是 `index.html` 加本地资源文件。

## 已有功能与边界

| 功能 | 实际能力 |
| --- | --- |
| 数据保存 | 本地编辑自动存入 localStorage；GitHub 读写由用户手动触发，不后台同步 |
| 信用卡 | 开卡日期 / 月份 / 未知日期，CL 与产品变更历史、关卡、6/12/24 月开卡节奏 |
| 收益看板 | 每卡与总体的消费返利、perk/报销减成本、SUB 净额；bank churn 单独列示 |
| 银行活动 | Checking / savings / 未拆分组合分别标记；本金、DD、奖励、利息、费用、资金机会成本 |
| SUB | 两档累计目标、期限、到账状态；学费手续费、诱导消费与替代方案损失测算；不追踪当前已消费额 |
| CPP | UR 与 Aeroplan 默认各 1.8 USD cents/point；滑块即时更新收益、类别比较及 SUB 测算 |
| Category 选卡 | 现金百分比 / 积分倍率、有效起止日期、条件备注、待核对标记；**不自动计算促销上限剩余额度** |
| 权益 | 月、季、自然半年、自然年、周年、指定周期；使用次数、参考价格、个人认可价值分开；**无 Status 独立账本及自动重叠去重** |
| 积分事件 | 赚点、买点、转点、兑换、退款、调整、快照；原币种税费与 USD 税费分别保存；不展示当前 UR 余额 |
| 导入导出 | 完整 JSON 备份与替换导入（上限 5 MB）、流水 CSV 导出；**无增量更新导入 / 自动合并** |
| 未知信息 | 多处支持留空、仅月份、仅年份和周期待核对；银行开户日仍必填，不能为满足表单而编造 |

待完成项及验收标准见 [BACKLOG.md](BACKLOG.md)。完整业务约束见 [AGENTS.md](AGENTS.md)。

## 本地预览与测试

开发需要 Node.js 22 或以上，不需要 `npm install`。PowerShell：

```powershell
git status --short --branch
git switch -c chore/your-change
npm.cmd test
npm.cmd run check
npm.cmd run preview
```

其他 shell 可以用 `npm` 代替 `npm.cmd`。打开 `http://127.0.0.1:8765`，结束预览按 Ctrl+C。预览脚本仅在本机提供六个应用资源；不提供 `.git`、账本或备份文件。它是开发工具，不是应用后端，不部署到服务端。

初次打开显示明确标注的虚构演示数据。开发时使用独立浏览器配置或独立测试来源，不输入真实 token，不读取真实云端账本。端口、域名、浏览器配置变化会产生不同 localStorage；本地测试来源与 Pages 的数据不共享。

`npm test` 使用 Node 内置测试运行器，覆盖会计规则、GitHub 模拟读写、fetch 绑定、SHA 冲突、本地保存、凭证隔离及整本导入保护。页面测试使用内存 DOM 适配器，不替代真实浏览器的视觉检查。`npm run check` 检查所有应用 / 测试 / 开发脚本的语法、HTML 本地资源及 `.nojekyll`。

每次代码修改后做上述检查，再用虚构数据打开总览、信用卡、权益、银行、积分、Category、设置；检查滑块、编辑、备份及窄屏布局。测试不访问 GitHub 网络或真实私有账本。实际 token 权限、真实网络和 Pages 发布仍需以后单独验证。

## 开发与后续发布

1. 阅读 README、AGENTS、BACKLOG、MEMORY 及最新相关 `handoff/`，核对当前 Git 分支与文件，不凭旧聊天判断已完成。
2. 在当前仓库的功能分支小步修改；会计 / GitHub 行为变化补回归用例，测试数据必须虚构。
3. 运行 `npm.cmd test`、`npm.cmd run check`、`git diff --check`，审查 `git diff` 与 `git status`。只暂存明确需要的文件，不用 `git add .`。
4. 查看 `git diff --cached`，提交说明写清问题、行为变化、验证和边界。更新 BACKLOG、相关交接记录及语义化 memory。
5. **本轮停在本地分支提交，不推送、不合并、不部署。** 后续经用户明确要求发布时，核对 Pages 来源仍为 `main` 根目录，再将审查后的应用代码合并/推送到 `main`；这会触发现有 Pages 发布，不需要新构建系统。
6. 发布后检查页面资源、虚构演示、浏览器控制台；应用发布与账本手动保存是两件事。不得在代码发布过程中上传、替换或重置私有数据。

部分历史源码在 Git 中使用 CRLF。差异检查用 `git -c core.whitespace=cr-at-eol diff --check`，避免把回车误报为空白错误；仍检查实际行尾空格，不全文件重排换行。

不调用 `gh repo edit --visibility`，不修改 Pages 来源，不把个人 JSON 嵌入 HTML，不增加部署工作流来替代当前方式。

## 用户手动保存到 GitHub

设置填写 owner `quentincong`、repo `perk-track-data`、path `data.json`，分支留空使用默认分支。Fine-grained token 仅授权数据仓库的 Contents 读写；通过 [GitHub token 设置](https://github.com/settings/personal-access-tokens/new) 管理凭证。

token 默认在 sessionStorage；勾选记住后在 localStorage。它与账本分开，不由正常 JSON / CSV 导出带出。清除凭证只影响本浏览器。只在可信的应用版本输入 token。

已有云端文件时：测试连接 → 读取云端（确认后先下载本地备份）→ 编辑 → 顶部“保存到 GitHub”。连接测试本身不能授权覆盖文件；读取取得的 SHA 随 PUT 写回。409、授权或网络失败保留本地数据，并要求重新核对云端；不强制覆盖或自动重试。只有仓库及分支已存在、文件确实缺失时，才可不带 SHA 创建文件。404 也可能是仓库、分支或权限问题，不能一概当作文件不存在。

整本 JSON 导入会替换本地数据并重置 GitHub 读取状态。它适合本地恢复，**不能直接用作更新既有云端账本**：随后读云端会再次替换本地。当前只能先备份、读最新云端、通过表单重新应用变更，再手动写回。通用增量 JSON 方案见 [docs/JSON_UPDATES.md](docs/JSON_UPDATES.md)，本轮未实现。

PowerShell 中运行 `gh` 要立即保存退出码并同时捕获 stderr，例如：

```powershell
$repoResult = & gh repo view quentincong/perk-track --json nameWithOwner 2>&1
$repoExit = $LASTEXITCODE
$repoResult
if ($repoExit -ne 0) { throw "gh failed (exit $repoExit); inspect the captured error" }
```

不要把上述查询失败自动当成 404；查询尚未创建的仓库得到明确 404 时是预期的不存在情况，网络失败不是。不要在脚本、日志或提交中输出 token。

## 会计口径与录入注意

- **银行**：实收奖励 + 利息 − 账户费用 − 银行专属成本 − 资金机会成本。Checking / savings 分列；混合活动不猜拆分。本金和 DD 不算收益，同一笔 DD 不重复录存款。机会成本按每日录入本金 × 年利率 / 365；`capitalComplete:false` 表示资料不全，不代表真实成本为零。
- **消费返利**：现金返利 + 正常刷卡赚点 × CPP − 该类成本。按卡和 category 汇总；飞行里程单列非信用卡赚点，不混入消费返利。
- **Perk**：已用权益的个人认可价值 + 单独录入的转点奖励等估值 − 已付年费及相关成本。计划年费、面值、起价或参考报价不自动算收益。Status 与卡片重叠时同一次使用只录一条，归因写备注；当前需人工去重。
- **SUB**：已到账奖励 − 诱导消费损失 − 刷卡手续费 − 替代方案损失。累计目标/状态不自动生成奖励。实际点数或现金用 `incomeBucket:'sub'` 记录；已有实际事件时不再累加卡片现金 offer。只知道现金已到账、却不知年份的摘要仅纳入全部年份，不猜入某一年。
- **学费**：本来要支付的本金不是损失。$16,000 × 2.52% = $403.20 可归 SUB 成本；正常 1x 赚点归消费返利。测算不自动记账，实际手续费、奖励各记一次。
- **估值不叠加**：赚点按原计划估值；转点本金不产生第二笔收入。转点 `received` 含已到账 bonus，bonus 另记 `earn` / `incomeBucket:'perk'` 并设置 `affectsBalance:false`，避免再次增加到账余额。兑换净价值和剩余积分资产是独立指标，不加到已估值赚点收益。
- **快照**：`type:'balance'` 将余额核对到指定点数，不产生收入。补记已含于快照的来源时，赚点关闭“改变余额”（`affectsBalance:false`），保留日期/年份、卡片、分类及归因备注。仅年份赚点与同年快照的先后未知且未标记时，不显示该计划余额，直至澄清或用后续年份快照核对。当前 UR 余额始终不统计，UR 赚点估值仍保留。
- **兑换**：只有现金参考价与 USD 税费都是已知数字时才算净价值/实测 CPP；已确认零税费填 `0`，未知留空。`taxesOriginal` / `taxesCurrency` 保存原币种，未换算不能当 USD。退款保留原兑换，记录退点、取消的参考价和实际退税，不同时删除原兑换。
- **未知与归因**：支持卡片 `openMonth` / `openUnknown`、若干收入与费用 `periodYear`、使用 `periodStart` / `periodEnd`（后者是下周期首日）、`cycleConfirmed:false`。不补假日期、金额或周期。周年无锚点不猜周期；CSP 等实际结单边界仍需指定真实周期或标待核对。每笔费用只归一张卡或一个银行活动，兑换税费、银行流水费用不重复记入成本账本。

## 文件与数据模型

| 文件 | 责任 |
| --- | --- |
| `index.html`、`styles.css` | 静态入口与响应式界面；资源路径均为相对路径 |
| `core.js` | v1 校验、日期/权益周期、余额、银行资金占用、旧汇总辅助指标 |
| `reports.js` | 分类收益 `report`、`bestCards`、`subScenario`、兼容迁移 |
| `github.js` | GitHub Contents API、Unicode 编解码、SHA 与读写状态 |
| `app.js` | 表单、路由、本地保存、完整导入导出、手动云端操作 |
| `tests/` | 虚构用例；会计、GitHub 模拟和页面逻辑回归 |
| `scripts/` | 无依赖本地检查与预览；不改变生产运行方式 |
| `docs/JSON_UPDATES.md` | 通用增量更新设计提案，未实现 |
| `handoff/`、`MEMORY.md`、`memory/` | 接手事实、维护决策与未来会话入口；不得放真实财务数据 |

完整账本 `schemaVersion:1` 包含 `settings` 和八个数组：`cards`、`creditEvents`、`perks`、`usages`、`banks`、`bankEvents`、`points`、`costs`；`rewardRules` 是可选数组。ID 全局唯一，关联必须存在，导入先校验再替换。UI 使用 `reports.report().totals` 作为分类收益；不要用仍含兑换价值的旧 `core.summary().net` 来替代它。旧备份中的 `subSpent` / `trackSubSpending` 保留兼容，但不再使用或展示。
