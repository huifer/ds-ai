# Connection System - 第三方服务连接管理

> 统一管理 Strava、Notion、RescueTime 等第三方服务的接入

## 📁 目录结构

```
src/connections/
├── index.mjs           # 统一导出
├── base.mjs            # Connection 基类
├── manager.mjs         # Connection 管理器
├── storage.mjs         # 本地存储
├── strava.mjs          # Strava 连接器

scripts/
├── connection-cli.mjs      # 命令行工具
├── connection-server.mjs   # OAuth 回调服务器

agent-core/agents/connection/
└── skills/
    └── connection-manager.skill.md  # AI Skill 定义
```

## 🚀 快速开始

### 1. 配置环境变量

```bash
# .env 文件中添加:

# Strava OAuth
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=http://localhost:3000/auth/strava/callback

# OAuth 服务器端口（可选）
OAUTH_PORT=3000
```

### 2. 创建 Strava API 应用

1. 访问 https://www.strava.com/settings/api
2. 创建应用，填写：
   - Application Name: `pi-discord-agents`
   - Category: `Personal`
   - Website: `http://localhost:3000`
   - Authorization Callback Domain: `localhost`
3. 复制 Client ID 和 Client Secret 到 .env

### 3. 启动 OAuth 服务器

```bash
# 终端 1: 启动 OAuth 回调服务器
node scripts/connection-server.mjs
```

### 4. 获取授权

```bash
# 终端 2: 获取授权 URL
node scripts/connection-cli.mjs auth strava

# 输出:
# 🔗 授权 strava
#
# 授权 URL:
# https://www.strava.com/oauth/authorize?client_id=xxxx&...
#
# 请在浏览器中打开上述链接完成授权。
```

### 5. 完成授权

在浏览器中打开授权 URL → 登录 Strava → 授权 → 
OAuth 服务器会自动处理回调并完成连接。

### 6. 验证连接

```bash
node scripts/connection-cli.mjs status strava

# 输出:
# 📊 strava 状态:
#
#   状态: ✅ 已连接
#   用户: 张三
```

## 💬 Discord 命令

在 Discord #主入口 发送：

```
# 列出所有连接
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

## 📊 查询数据

```
# Strava 查询
!connection query strava recent 10
!connection query strava stats weekly
!connection query strava stats monthly
```

## ⏰ 定时任务

Connection 系统会自动同步数据：

| 时间 | 任务 |
|------|------|
| 06:00 | 同步所有已连接服务 |
| 21:00 | 备份最新数据 |

## 🔧 开发

### 添加新服务

1. 创建 `src/connections/<service>.mjs`
2. 继承 `ConnectionBase` 类
3. 实现必需方法
4. 在 `manager.mjs` 中导入注册

```javascript
// src/connections/mynewservice.mjs
import { ConnectionBase, ConnectionRegistry } from './base.mjs';

class MyNewServiceConnection extends ConnectionBase {
  constructor() {
    super({
      id: 'mynewservice',
      name: 'MyNewService',
      description: '服务描述',
      icon: '🔧',
    });
  }
  
  async getAuthUrl() { /* ... */ }
  async exchangeCode(code) { /* ... */ }
  async query(params) { /* ... */ }
  async getStatus() { /* ... */ }
}

const conn = new MyNewServiceConnection();
ConnectionRegistry.register(conn);
export default conn;
```

### 测试

```bash
# 列出所有服务
node scripts/connection-cli.mjs list

# 同步特定服务
node scripts/connection-cli.mjs sync strava

# 查看详细状态
node scripts/connection-cli.mjs status strava
```

## 📝 数据存储

连接凭证存储在：
```
data/connections/credentials.json
```

格式：
```json
{
  "connection_strava": {
    "access_token": "xxx",
    "refresh_token": "xxx",
    "expires_at": 1234567890,
    "athlete_id": 123456,
    "athlete_name": "张三"
  }
}
```

## 🔒 安全

- 凭证仅存储在本地
- 不上传到任何云服务
- 断开连接时自动清理
- Token 过期自动刷新
