// src/connections/index.mjs
// Connection 系统导出

export { ConnectionBase, ConnectionRegistry } from './base.mjs';
export { ConnectionManager } from './manager.mjs';
export { default as strava, StravaConnection } from './strava.mjs';

// 初始化
import manager from './manager.mjs';
import strava from './strava.mjs';

// 注册所有 connection
// ConnectionRegistry 已在各 connection 文件中自动注册

export async function initConnections() {
  await manager.init();
}

export default manager;
