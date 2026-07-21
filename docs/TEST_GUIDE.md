# 🧪 输入层面测试指南

## 概述

这个项目是一个 Discord <-> Pi RPC 桥，包含一个记忆系统。以下是各个模块的测试方法：

---

## ✅ 测试脚本已创建

运行完整的输入层面测试：

```bash
node test-input-guide.mjs
```

---

## 📋 各模块测试说明

### 1️⃣ Discord 频道清理

**测试内容**: 清理所有频道的历史消息

```bash
# 清理所有频道的历史消息
node scripts/clear-discord-messages.mjs
```

**预期结果**: 删除所有频道的历史消息

---

### 2️⃣ 记忆存储 (Memory Store)

**测试内容**: 创建和查询各种类型的记忆

**测试方法**: 运行 `test-input-guide.mjs` 中的测试 1

**关键 API**:
- `memoryStore.upsert(mem)` - 创建/更新记忆
- `memoryStore.query({ kind, status, tag })` - 查询记忆

**预期结果**:
- ✅ 成功创建 preference, decision, idea, constraint 等类型的记忆
- ✅ 能够按类型、标签查询记忆

---

### 3️⃣ 记忆上下文 (Memory Context)

**测试内容**: 根据用户输入智能检索相关记忆

**测试方法**: 运行 `test-input-guide.mjs` 中的测试 2

**关键 API**:
- `memoryContext.buildContext({ userText, limit })` - 构建上下文

**测试输入**:
- "我想用 TypeScript 开发新项目"
- "bot 的性能怎么样"
- "有什么新功能想法"

**预期结果**:
- ✅ 返回相关的上下文信息
- ✅ 上下文内容与用户输入相关

---

### 4️⃣ 记忆治理 (Memory Governance)

**测试内容**: 过期清理和矛盾检测

**测试方法**: 运行 `test-input-guide.mjs` 中的测试 3

**关键 API**:
- `memoryGovernance.runGovernance({ dryRun })` - 运行治理

**测试内容**:
- 创建过期记忆（过期时间在过去）
- 创建矛盾记忆（与现有记忆冲突）

**预期结果**:
- ✅ 检测到过期记忆
- ✅ 检测到矛盾记忆组

---

### 5️⃣ 记忆质量 (Memory Quality)

**测试内容**: 置信度更新和质量报告

**测试方法**: 运行 `test-input-guide.mjs` 中的测试 4

**关键 API**:
- `memoryQuality.batchUpdate({ dryRun })` - 批量更新置信度
- `memoryQuality.report()` - 生成质量报告

**预期结果**:
- ✅ 批量更新置信度
- ✅ 生成质量报告，显示置信度分布

---

### 6️⃣ 记忆蒸馏 (Memory Distiller)

**测试内容**: 从对话中提取结构化记忆

**注意**: 蒸馏功能需要更多配置，目前跳过测试

---

## 🎯 快速测试单个功能

如果你想单独测试某个功能，可以使用现有的测试脚本：

```bash
# 简单测试
node test-simple.mjs

# 记忆蒸馏测试
node test-distill.mjs

# 完整测试沙盒
node test-playground.mjs

# 自动测试
node test-auto.mjs

# 重复冲突测试
node test-duplicates-conflicts.mjs
```

---

## 📊 测试总结

运行 `node test-input-guide.mjs` 后，会看到以下测试结果：

| 测试项 | 状态 |
|-------|------|
| 记忆存储 | ✅ |
| 记忆上下文 | ✅ |
| 记忆治理 | ✅ |
| 记忆质量 | ✅ |

同时会显示当前的记忆统计：
- 总记忆数
- 各类型记忆数量

---

## 🔧 故障排查

### 如果测试失败

1. **检查配置**: 确保 `.env` 文件配置正确
2. **检查依赖**: 运行 `npm install` 确保所有依赖已安装
3. **查看日志**: 检查 `logs/` 目录中的日志文件

### 如果 Discord 清理失败

1. **检查权限**: 确保 Bot 有足够的权限（Manage Messages）
2. **检查 Token**: 确保 `.env` 中的 Discord Token 正确
3. **检查频道 ID**: 确保频道 ID 存在且 Bot 有访问权限