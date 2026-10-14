# 架构与维护偏好

- 用户要求直接维护现有仓库，优先小改动，不重写 UI，不新增框架、生产后端或第三方服务；纯 HTML/CSS/JS 必须独立于 ChatGPT 运行。
- 2026-10-14 接手目录为空；克隆公开 `quentincong/perk-track` 到 `C:\Users\qc\perk-track`，基线 `e355ed4`。没有迁移旧 workspace 的未提交文件。README 原先提到的自包含 HTML、tests/npm 配置及旧旅行脚本不在取得的仓库中。
- 只读核实应用仓库 public、Pages `legacy` / `main` / 根目录；不擅自改 visibility 或发布方式。未来 private 的计划由用户决定。本轮分支 `chore/project-handoff`，只本地提交，不推送/部署。
- 真实账本位置由用户指定，独立私有 `quentincong/perk-track-data/data.json`；本轮未访问。开发和回归只用虚构数据/模拟请求，任何真实账本/token/账户明细/备份不进入应用仓库或 memory。
- Windows Node >=22；无需 npm install。`npm.cmd test`、`npm.cmd run check`、`npm.cmd run preview`（127.0.0.1:8765）。预览只提供静态应用资源；不改生产部署。`git diff --check` 和暂存审查后逐文件提交。
- 历史源码部分在 Git 中为 CRLF，使用 `git -c core.whitespace=cr-at-eol diff --check`；保持小差异，不无关全文件重排换行。
- `app.js` 管理本地保存与用户手动云端操作；`core.js` 校验、周期、余额、资金占用；`reports.js` 分类收益；`github.js` 编解码与 Contents API。保持默认 fetch 的 globalThis 绑定。
- GithubStore 必须读最新数据取得 SHA，不能仅 prepare 已有文件后写；404 创建还需确认分支；失败撤销可写状态，409 不盲重试。PowerShell 立即捕获 gh 退出码及 stderr，区分不存在与网络/授权失败。
- 完整 JSON 导入是替换+重置 store，不能当增量云端更新。后续提案在 docs/JSON_UPDATES.md：稳定 ID、before/after、差异预览、SHA、幂等、无后端；本轮未实现合并器。
- 2026-10-14 用户在交接整理提交 `6fcad71` 后明确要求 push，使改动可在实际 GitHub Pages 使用；这次发布已授权，不应再停在本地提交或再次征求确认。授权不包含私有账本、仓库权限或部署方式变更。发布结果核对 GitHub Pages build 的 commit/status 和线上应用资源。
