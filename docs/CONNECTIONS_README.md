# 🚴 Strava Connection System

> AI Personal OS 的第一个第三方服务连接器

## 🎯 概述

Connection System 是 AI Personal OS 的核心基础设施，用于统一管理第三方服务的接入。

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Personal OS                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐  │
│   │   Skill     │ ──▶ │   Manager    │ ──▶ │ Connection  │  │
│   │  (指令层)   │     │  (管理层)    │     │  (技术层)    │  │
│   └─────────────┘     └─────────────┘     └─────────────┘  │
│         │                   │                   │           │
│         ▼                   ▼                   ▼           │
│   Discord Chat       OAuth 流程         Strava API          │
│   用户对话           授权管理           运动数据              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📁 目录结构

```
src/connections/
├── index.mjs              # 统一导出
├── base.mjs               # Connection 基类
├── manager.mjs            # Connection 管理器
├── storage.mjs            # 本地存储
└── strava.mjs             # Strava 连接器

scripts/
├── connection-cli.mjs         # 命令行工具
├── connection-server.mjs       # OAuth 回调服务器
└── connection-quickstart.mjs  # 快速开始向导

agent-core/agents/connection/
└── skills/
    └── connection-manager.skill.md  # AI Skill 定义

docs/
└── connections.md              # 详细文档
```

## 🚀 快速开始

### 方法 1: 交互式向导

```bash
node scripts/connection-quickstart.mjs
```

### 方法 2: 手动配置

**Step 1: 创建 Strava API 应用**

1. 访问 https://www.strava.com/settings/api
2. 创建应用:
   - Application Name: `pi-discord-agents`
   - Category: `Personal`
   - Authorization Callback Domain: `localhost`
3. 复制 Client ID 和 Client Secret

**Step 2: 配置环境变量**

```bash
# .env 文件中添加:
STRAVA_CLIENT_ID=你的_client_id
STRAVA_CLIENT_SECRET=你的_client_secret
STRAVA_REDIRECT_URI=http://localhost:3000/auth/strava/callback
OAUTH_PORT=3000
```

**Step 3: 启动 OAuth 服务器**

```bash
node scripts/connection-server.mjs
```

**Step 4: 获取授权**

```bash
# 新终端:
node scripts/connection-cli.mjs auth strava

# 浏览器打开显示的 URL，完成授权
```

**Step 5: 验证**

```bash
node scripts/connection-cli.mjs status strava
node scripts/connection-cli.mjs list
```

## 💬 Discord 命令

```
# 查看所有连接
!connection list

# 添加新连接
!connection add strava

# 查看状态
!connection status strava

# 同步数据
!connection sync strava

# 断开连接
!connection remove strava

# 获取帮助
!connection help
```

## 📊 数据查询

```
# Strava 查询
!connection query strava recent 10        # 最近 10 次活动
!connection query strava stats weekly     # 本周统计
!connection query strava stats monthly    # 本月统计
```

## 🔧 API

### ConnectionManager

```javascript
import manager from './src/connections/manager.mjs';

// 初始化
await manager.init();

// 列出所有服务
const services = manager.listServices();

// 获取授权 URL
const { authUrl } = await manager.getAuthUrl('strava');

// 处理 OAuth 回调
await manager.handleCallback('strava', code);

// 查询数据
const data = await manager.query('strava', { 
  type: 'recent', 
  limit: 10 
});

// 查看状态
const status = await manager.getStatus('strava');

// 同步数据
await manager.sync('strava');

// 断开连接
await manager.disconnect('strava');
```

### Connection 基类

```javascript
import { ConnectionBase } from './base.mjs';

class MyConnection extends ConnectionBase {
  constructor() {
    super({
      id: 'myapp',
      name: 'MyApp',
      description: '描述',
      icon: '📱',
    });
  }
  
  async getAuthUrl() { /* OAuth URL */ }
  async exchangeCode(code) { /* 交换 token */ }
  async query(params) { /* 查询数据 */ }
  async getStatus() { /* 返回状态 */ }
}
```

## 📈 已实现功能

### Strava

- ✅ OAuth 授权流程
- ✅ Token 自动刷新
- ✅ 获取运动员信息
- ✅ 获取活动列表
- ✅ 获取活动详情
- ✅ 获取统计数据（周/月/年）
- ✅ 格式化输出

### 系统

- ✅ 统一存储 (credentials.json)
- ✅ CLI 工具
- ✅ OAuth 回调服务器
- ✅ AI Skill 定义

## 🔜 下一步

### 添加更多服务

参考 `src/connections/strava.mjs`，创建新的连接器：

- [ ] Notion
- [ ] RescueTime
- [ ] Garmin
- [ ] Apple HealthKit
- [ ] Plaid
- [ ] Todoist
- [ ] Linear

### 定时任务

- [ ] 每日自动同步
- [ ] 每周运动报告推送到 Discord
- [ ] 数据备份

### 高级功能

- [ ] 数据可视化（图表）
- [ ] 跨服务关联分析
- [ ] 智能建议

## 🐛 故障排除

**Q: OAuth 回调失败**
```
❌ 授权失败: Redirect URI mismatch
```
A: 确保 Strava API 设置中的 Callback Domain 是 `localhost`

**Q: Token 过期**
```
❌ Token expired
```
A: 系统会自动刷新，如果失败请重新授权：
```
node scripts/connection-cli.mjs remove strava
node scripts/connection-cli.mjs auth strava
```

**Q: 找不到 STRAVA_CLIENT_ID**
A: 检查 .env 文件配置是否正确加载

## 📝 License

MIT
