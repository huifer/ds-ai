// src/connections/manager.mjs
// Connection 管理器 - 统一管理所有第三方服务连接

import { ConnectionRegistry } from './base.mjs';
import strava from './strava.mjs';

// 延迟导入其他 connections
// import notion from './notion.mjs';
// import rescuetime from './rescuetime.mjs';

/**
 * Connection Manager
 * 提供统一的连接管理接口
 */
class ConnectionManager {
  constructor() {
    this.connections = ConnectionRegistry.connections;
  }
  
  // ============ 初始化 ============
  
  async init() {
    // 加载所有已保存的 credentials
    await ConnectionRegistry.loadAll();
  }
  
  // ============ 连接管理 ============
  
  /**
   * 获取所有可用服务
   */
  listServices() {
    return ConnectionRegistry.list();
  }
  
  /**
   * 获取连接状态
   * @param {string} serviceId
   */
  async getStatus(serviceId) {
    const conn = this.connections.get(serviceId);
    if (!conn) {
      throw new Error(`Unknown service: ${serviceId}`);
    }
    return conn.getStatus();
  }
  
  /**
   * 获取所有已连接的服务
   */
  async listConnected() {
    const result = [];
    for (const [id, conn] of this.connections) {
      const status = await conn.getStatus();
      result.push({
        id,
        name: conn.name,
        icon: conn.icon,
        ...status,
      });
    }
    return result;
  }
  
  // ============ OAuth 流程 ============
  
  /**
   * 获取授权 URL
   * @param {string} serviceId
   */
  async getAuthUrl(serviceId) {
    const conn = this.connections.get(serviceId);
    if (!conn) {
      throw new Error(`Unknown service: ${serviceId}`);
    }
    
    if (conn.isConnected()) {
      throw new Error(`${conn.name} already connected`);
    }
    
    return conn.getAuthUrl();
  }
  
  /**
   * 处理 OAuth 回调
   * @param {string} serviceId
   * @param {string} code
   */
  async handleCallback(serviceId, code) {
    const conn = this.connections.get(serviceId);
    if (!conn) {
      throw new Error(`Unknown service: ${serviceId}`);
    }
    
    const credentials = await conn.exchangeCode(code);
    return {
      service: conn.name,
      athlete_id: credentials.athlete_id,
      athlete_name: credentials.athlete_name,
    };
  }
  
  // ============ 数据操作 ============
  
  /**
   * 查询数据
   * @param {string} serviceId
   * @param {object} params
   */
  async query(serviceId, params = {}) {
    const conn = this.connections.get(serviceId);
    if (!conn) {
      throw new Error(`Unknown service: ${serviceId}`);
    }
    
    if (!conn.isConnected()) {
      throw new Error(`${conn.name} not connected. Use "!connection add ${serviceId}" first.`);
    }
    
    return conn.query(params);
  }
  
  /**
   * 同步数据
   * @param {string} serviceId
   */
  async sync(serviceId) {
    const conn = this.connections.get(serviceId);
    if (!conn) {
      throw new Error(`Unknown service: ${serviceId}`);
    }
    
    if (!conn.isConnected()) {
      throw new Error(`${conn.name} not connected`);
    }
    
    return conn.sync();
  }
  
  /**
   * 断开连接
   * @param {string} serviceId
   */
  async disconnect(serviceId) {
    const conn = this.connections.get(serviceId);
    if (!conn) {
      throw new Error(`Unknown service: ${serviceId}`);
    }
    
    await conn.disconnect();
    return { service: conn.name, disconnected: true };
  }
  
  // ============ 帮助方法 ============
  
  /**
   * 生成帮助信息
   */
  help() {
    const services = this.listServices();
    let text = '**Connection 命令帮助**\n\n';
    text += '**可用命令:**\n';
    text += '• `!connection list` - 列出所有已连接的服务\n';
    text += '• `!connection add <service>` - 添加新连接（如 `!connection add strava`）\n';
    text += '• `!connection status <service>` - 查看连接状态\n';
    text += '• `!connection sync <service>` - 同步最新数据\n';
    text += '• `!connection remove <service>` - 断开连接\n';
    text += '• `!connection help` - 显示帮助\n\n';
    text += '**可用服务:**\n';
    
    for (const s of services) {
      text += `• ${s.icon} ${s.name} - ${s.description}\n`;
    }
    
    return text;
  }
}

// 单例
const manager = new ConnectionManager();

export default manager;
export { ConnectionManager };
