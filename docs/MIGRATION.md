# 命令系统迁移说明

## 概述

本次更新移除了所有兼容命名，统一使用标准命名，并添加了 `!help` 命令系统。

## 频道命名变更

### 移除的兼容命名

| 旧命名 | 新命名 | 状态 |
|--------|--------|------|
| `CH_TREND` | `CH_USAGE` | ✅ 已移除 |
| `CH_DISCOVER` | `CH_OPPORTUNITY` | ✅ 已移除 |

### 当前标准频道命名

| 环境变量 | 频道 | Emoji |
|----------|------|-------|
| `CH_ENTRY` | #主入口 | 📝 |
| `CH_MEMORY` | #记忆库 | 🧠 |
| `CH_IDEAS` | #灵感 | ✨ |
| `CH_BUILD` | #工程 | 🔨 |
| `CH_SYSTEM` | #系统 | 🛠 |
| `CH_RSS` | #资讯 | 📰 |
| `CH_DAILY` | #每日总结 | 🌙 |
| `CH_GH` | #每日任务 | 🎯 |
| `CH_USAGE` | #用量 | 📊 |
| `CH_OPPORTUNITY` | #机会 | 💡 |

## 命令命名变更

### 移除的命令别名

| 旧命令 | 新命令 | 状态 |
|--------|--------|------|
| `!trend` | `!usage` | ✅ 已移除 |
| `!discover` | `!opportunity` | ✅ 已移除 |

### 当前标准命令

| 命令 | 功能 |
|------|------|
| `!help` | 显示命令帮助 |
| `!watch` | 仓库监控管理 |
| `!archive` | 显式知识归档 |
| `!usage` | Token 使用量报告 |
| `!distill` | 手动触发记忆蒸馏 |
| `!memory` | 记忆管理 |
| `!opportunity` | 机会发现调研 |

## 新增功能

### !help 命令

```bash
!help                    # 显示命令总览
!help <命令名>           # 显示指定命令的详细帮助
```

示例：
```bash
!help           # 查看所有可用命令
!help watch     # 查看 !watch 命令的详细用法
!help archive   # 查看 !archive 命令的详细用法
```

## 文档

详细命令参考请查看 `docs/COMMANDS.md`。

## 配置文件变更

### .env.example

- 移除 `CH_TREND` 配置项
- 移除 `CH_USAGE` 的注释说明
- 统一使用 `CH_USAGE`

### .env (用户需要更新)

如果你的 `.env` 中仍在使用旧命名，需要更新：

```diff
- CH_TREND=12345678901234567890
+ CH_USAGE=12345678901234567890
```

## 代码文件变更

### src/config.mjs

- 移除 `CH_TREND` 和 `CH_DISCOVER` 的兼容逻辑
- 简化频道配置结构

### src/entry-bot.mjs

- 移除 `!trend` 命令别名处理
- 移除 `!discover` 命令别名处理
- 移除 `CH_TREND` 和 `CH_DISCOVER` 环境变量传递
- 添加 `!help` 命令处理函数 `handleHelpCommand()`

### .env.example

- 更新频道配置模板，移除兼容命名

### README.md

- 移除对 `!discover` 别名的说明

## 迁移检查清单

- [x] 更新 `.env.example` 配置模板
- [x] 修改 `src/config.mjs` 移除兼容逻辑
- [x] 修改 `src/entry-bot.mjs` 移除命令别名
- [x] 添加 `!help` 命令支持
- [x] 创建 `docs/COMMANDS.md` 命令参考文档
- [x] 更新 `README.md` 移除别名说明
- [ ] 用户更新 `.env` 配置文件（用户自行完成）

## 向后兼容说明

⚠️ **本次更新不向后兼容**

如果你之前使用 `!trend` 或 `!discover` 命令，需要改为：
- `!trend` → `!usage`
- `!discover` → `!opportunity`

如果你的 `.env` 中使用了 `CH_TREND` 或 `CH_DISCOVER`，需要更新为标准命名。