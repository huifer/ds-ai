# 项目整理方案

> **日期**: 2026-07-21
> **目标**: 清理根目录杂乱文件，规范项目结构

---

## 📋 整理清单

### 1️⃣ 测试文件移至 test/ 目录

以下 test-*.mjs 文件应移到 `test/` 目录：

| 文件 | 目标位置 | 状态 |
|------|---------|------|
| test-auto.mjs | test/ | 移动 |
| test-bot-commands.mjs | test/ | 移动 |
| test-command-router.mjs | test/ | 移动 |
| test-commands-direct.mjs | test/ | 移动 |
| test-create-journal.mjs | test/ | 移动 |
| test-distill*.mjs (3个) | test/ | 移动 |
| test-duplicates-conflicts.mjs | test/ | 移动 |
| test-e2e-*.mjs (2个) | test/ | 移动 |
| test-entry-integration.mjs | test/ | 移动 |
| test-file-search.mjs | test/ | 移动 |
| test-final.mjs | test/ | 移动 |
| test-input-guide.mjs | test/ | 移动 |
| test-local-integration.mjs | test/ | 移动 |
| test-memory*.mjs (4个) | test/ | 移动 |
| test-multi-agent.mjs | test/ | 移动 |
| test-pdf.mjs | test/ | 移动 |
| test-pi-rpc.mjs | test/ | 移动 |
| test-playground.mjs | test/ | 移动 |
| test-project-system.mjs | test/ | 移动 |
| test-real-agent-loading.mjs | test/ | 移动 |
| test-routing-real.mjs | test/ | 移动 |
| test-simple.mjs | test/ | 移动 |
| test-supersede.mjs | test/ | 移动 |
| test-team*.mjs (2个) | test/ | 移动 |
| test-workflow.mjs | test/ | 移动 |
| test-xiasi-*.mjs (4个) | test/ | 移动 |

**总计**: ~40 个测试文件

---

### 2️⃣ 辅助脚本移至 scripts/ 或删除

| 文件 | 操作 | 原因 |
|------|------|------|
| agent-bot.mjs | 删除 | 临时脚本，已有 src/entry-bot.mjs |
| multi-agent-status.mjs | 移至 scripts/ | 有用的状态查询工具 |
| verify-agents.mjs | 移至 scripts/ | 有用的验证工具 |
| list-discord-channels.mjs | 移至 scripts/ | 有用的调试工具 |
| memory-journal.mjs | 移至 scripts/ | 有用的记忆管理工具 |
| go-to-sleep.mjs | 移至 scripts/ | 有用的工具 |
| manual-dream.mjs | 移至 scripts/ | 有用的梦境工具 |

---

### 3️⃣ 日志和数据文件

| 文件/目录 | 操作 | 原因 |
|----------|------|------|
| entry-bot.log | 移至 logs/ | 日志文件应在 logs/ 目录 |
| pi-session-*.html | 删除 | 大文件（6.5MB），临时调试产物 |
| TEST_REPORT.md | 移至 docs/reports/ | 测试报告应归档 |

---

### 4️⃣ 项目系统文件

| 文件/目录 | 操作 | 原因 |
|----------|------|------|
| PRJ-*.yaml (5个) | 移至 data/projects/ | 项目系统的数据文件 |
| PRJ-*/ (5个目录) | 移至 data/projects/ | 项目系统的工作目录 |
| test-user/ | 删除 | 临时测试目录 |

---

### 5️⃣ 临时文件

| 文件 | 操作 |
|------|------|
| ming-tai-report-error-handling.json | 删除 |

---

### 6️⃣ agent-core/agents/ 新文件

需要检查以下新文件是否应加入版本控制：

- agent-core/agents/coding/ 目录及内容
- agent-core/agents/*/ 新增内容

**建议**: 检查后如果是正式代码，加入 git；如果是临时测试文件，删除或移至 drafts/

---

## 🚀 执行步骤

### 阶段 1: 创建目标目录
```bash
mkdir -p test/
mkdir -p scripts/
mkdir -p logs/
mkdir -p data/projects/
mkdir -p docs/reports/
```

### 阶段 2: 移动文件
```bash
# 移动测试文件
mv test-*.mjs test/

# 移动辅助脚本
mv multi-agent-status.mjs scripts/
mv verify-agents.mjs scripts/
mv list-discord-channels.mjs scripts/
mv memory-journal.mjs scripts/
mv go-to-sleep.mjs scripts/
mv manual-dream.mjs scripts/

# 移动日志
mv entry-bot.log logs/

# 移动项目文件
mv PRJ-*.yaml data/projects/
mv PRJ-*/ data/projects/

# 移动测试报告
mv TEST_REPORT.md docs/reports/
```

### 阶段 3: 删除临时文件
```bash
rm -f pi-session-*.html
rm -f ming-tai-report-error-handling.json
rm -rf test-user/
rm -f agent-bot.mjs
```

### 阶段 4: 检查 agent-core/agents/ 新内容
```bash
# 查看新增内容
git status agent-core/agents/

# 决定是否加入版本控制
```

---

## 📊 预期结果

### 整理后的根目录结构

```
pi-discord-agents/
├── .env
├── .env.example
├── .gitignore
├── package.json
├── README.md
├── CONTEXT.md
├── CLEANUP_PLAN.md
├── agent-core/
├── config/
├── data/
├── docs/
├── extensions/
├── legacy/
├── links/
├── logs/
├── profile/
├── scripts/
├── sessions/
├── src/
└── test/
```

---

## ⚠️ 注意事项

1. **备份**: 执行前建议创建当前状态的备份分支
2. **测试**: 移动后需要验证相关脚本是否仍能正常运行
3. **.gitignore**: 确保 data/projects/ 已加入 .gitignore（如果是数据文件）
4. **引用更新**: 检查是否有文档引用了这些文件的路径

---

## 🔄 回滚方案

如果需要回滚，可以使用：

```bash
# 创建整理前的备份
git checkout -b backup/pre-cleanup-20260721

# 如果需要回滚
git checkout main
git clean -fd  # 清理未追踪文件（小心使用！）
```
