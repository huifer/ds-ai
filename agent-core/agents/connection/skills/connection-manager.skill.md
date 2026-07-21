# Connection Manager Skill

> 管理用户与第三方服务的连接（Strava、Notion、RescueTime 等）

## Skill ID
`connection-manager`

## 触发条件
用户发送以 `!connection` 开头的命令，或询问以下内容：
- "连接管理"
- "已连接哪些服务"
- "如何添加新连接"
- "同步数据"

## 核心能力

### 1. 列出已连接服务
**命令**: `!connection list`

**输出格式**:
```
📋 已连接服务 (2/5)

✅ 🚴 Strava - 张三
   └─ 上次同步: 2026-07-20 08:30

✅ 📝 Notion
   └─ 上次同步: 2026-07-19 22:00

❌ ⏱️ RescueTime - 未连接
❌ 🏠 Home Assistant - 未连接
❌ 💰 Plaid - 未连接
```

### 2. 添加新连接
**命令**: `!connection add <service>`

**示例**:
- `!connection add strava`
- `!connection add notion`
- `!connection add rescuetime`

**流程**:
1. 用户执行命令
2. AI 调用 `manager.getAuthUrl(serviceId)`
3. AI 回复授权链接
4. 用户点击授权
5. 回调自动处理（无需用户操作）
6. AI 确认连接成功

**AI 回复模板**:
```
🔗 授权 ${serviceName}

请访问以下链接完成授权：
${authUrl}

授权成功后我会自动确认连接状态。
```

### 3. 查看连接状态
**命令**: `!connection status <service>`

**输出格式**:
```
🚴 Strava 连接状态

状态: ✅ 已连接
用户: 张三
地区: 中国 北京
上次同步: 2026-07-20 08:30
Token 有效期: 剩余 1,234 秒
```

### 4. 同步数据
**命令**: `!connection sync <service>`

**示例**:
- `!connection sync strava` - 同步最新运动数据
- `!connection sync all` - 同步所有已连接服务

**AI 回复模板**:
```
🔄 正在同步 ${serviceName}...

✅ 同步完成
└─ 拉取活动: 5 条
└─ 更新统计: 骑行 45km, 跑步 12km
└─ 同步时间: 2026-07-20 14:30
```

### 5. 断开连接
**命令**: `!connection remove <service>`

**示例**:
- `!connection remove strava`

**AI 回复模板**:
```
⚠️ 确认断开 ${serviceName}？

这将清除所有存储的凭证和数据。

确认请回复 "是，断开 ${serviceId}"
```

用户确认后:
```
✅ 已断开 ${serviceName}
└─ 凭证已清除
└─ 数据已归档到: data/connections/archives/${serviceId}/
```

## 数据查询命令

### Strava 特定查询

**最近活动**:
- `!connection query strava recent 10` - 最近 10 次活动
- `!connection query strava recent 5 running` - 最近 5 次跑步

**统计数据**:
- `!connection query strava stats weekly` - 本周统计
- `!connection query strava stats monthly` - 本月统计
- `!connection query strava stats yearly` - 年度统计

**活动详情**:
- `!connection query strava activity <id>` - 特定活动详情

**输出格式示例**:
```
🚴 最近活动 (5/10)

1. 晨跑 - 5.2km, 28'32", 5'30/km 🏃
   └─ 2026-07-20 07:00, 心率 142 bpm

2. 夜骑 - 18.5km, 45'12", 24.5 km/h 🚴
   └─ 2026-07-19 20:30, 心率 128 bpm

3. 间歇跑 - 4.1km, 22'15", 5'26/km 🏃
   └─ 2026-07-18 07:15, 心率 155 bpm
```

```
📊 本周运动统计

🏃 跑步:
   次数: 3 次
   距离: 15.3 km
   时长: 1h 28m
   爬升: 185 m

🚴 骑行:
   次数: 2 次
   距离: 38.2 km
   时长: 1h 32m

🏊 游泳:
   次数: 1 次
   距离: 1500 m
   时长: 45m
```

## 错误处理

### 未连接
```
❌ ${serviceName} 未连接

请先添加连接：
!connection add ${serviceId}
```

### Token 过期
```
⚠️ ${serviceName} Token 已过期

正在自动刷新...
✅ Token 已刷新

如需手动重新授权：
!connection add ${serviceId}
```

### 服务不可用
```
❌ ${serviceName} 暂时不可用

错误: ${error_message}
建议: 稍后重试或联系管理员
```

### 未知服务
```
❌ 未知服务: ${serviceId}

可用服务:
• strava - 运动数据追踪
• notion - 笔记和数据库
• rescuetime - 时间追踪
• homeassistant - 智能家居
• plaid - 财务账户
```

## 定时任务

### 自动同步
- 每天 06:00 - 同步所有已连接服务
- 每天 21:00 - 备份最新数据

### 定时报告
- 每周一 09:00 - 生成上周运动/工作摘要（通过对应服务 Agent）

## 安全注意

- 所有 OAuth 凭证存储在本地 `data/connections/credentials.json`
- 凭证经过加密存储
- 断开连接时自动清理敏感数据
- 不存储明文 token
