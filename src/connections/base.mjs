// src/connections/base.mjs
// Connection 基类 - 所有第三方服务集成的父类

export class ConnectionBase {
  constructor(config) {
    this.id = config.id;                    // 'strava', 'notion', 'rescuetime'
    this.name = config.name;                // 'Strava', 'Notion', 'RescueTime'
    this.description = config.description;  // 简短描述
    this.icon = config.icon;                // emoji: 🚴, 📝, ⏱️
    
    // OAuth 配置
    this.authUrl = config.authUrl;          // 授权 URL
    this.tokenUrl = config.tokenUrl;         // 获取 token 的 URL
    this.scopes = config.scopes || [];       // 需要权限
    
    // 存储路径
    this.storageKey = `connection_${this.id}`;
    
    // 状态
    this.credentials = null;
  }
  
  // ============ 必须实现的方法 ============
  
  /**
   * 获取 OAuth 授权 URL
   * @returns {Promise<{authUrl: string, state: string}>}
   */
  async getAuthUrl() {
    throw new Error('Not implemented');
  }
  
  /**
   * 使用授权码交换 token
   * @param {string} code - 授权码
   * @returns {Promise<object>} - credentials 对象
   */
  async exchangeCode(code) {
    throw new Error('Not implemented');
  }
  
  /**
   * 刷新 token
   * @returns {Promise<object>} - 新 credentials
   */
  async refreshToken() {
    throw new Error('Not implemented');
  }
  
  /**
   * 查询数据
   * @param {object} params - 查询参数
   * @returns {Promise<any>}
   */
  async query(params) {
    throw new Error('Not implemented');
  }
  
  /**
   * 获取连接状态
   * @returns {Promise<{connected: boolean, info?: object}>}
   */
  async getStatus() {
    throw new Error('Not implemented');
  }
  
  // ============ 可选覆盖的方法 ============
  
  /**
   * 断开连接（清理 credentials）
   */
  async disconnect() {
    this.credentials = null;
    await this.saveCredentials(null);
  }
  
  /**
   * 同步最新数据
   */
  async sync() {
    // 默认实现：返回 OK
    return { synced: true, timestamp: new Date().toISOString() };
  }
  
  // ============ 基类工具方法 ============
  
  /**
   * 保存 credentials 到 storage
   */
  async saveCredentials(credentials) {
    const storage = await import('../storage.mjs');
    await storage.set(this.storageKey, credentials);
    this.credentials = credentials;
  }
  
  /**
   * 加载 credentials
   */
  async loadCredentials() {
    const storage = await import('../storage.mjs');
    this.credentials = await storage.get(this.storageKey);
    return this.credentials;
  }
  
  /**
   * 检查是否已连接
   */
  isConnected() {
    return !!this.credentials;
  }
  
  /**
   * 检查 token 是否过期
   */
  isTokenExpired() {
    if (!this.credentials?.expires_at) return false;
    return Date.now() >= this.credentials.expires_at;
  }
}

// 导出所有 Connection 类
export const ConnectionRegistry = {
  connections: new Map(),
  
  register(connection) {
    this.connections.set(connection.id, connection);
  },
  
  get(id) {
    return this.connections.get(id);
  },
  
  list() {
    return Array.from(this.connections.values()).map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      icon: c.icon,
      connected: c.isConnected(),
    }));
  },
  
  async loadAll() {
    for (const conn of this.connections.values()) {
      await conn.loadCredentials();
    }
  }
};
