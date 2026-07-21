// src/storage.mjs
// 统一的本地存储模块 - 管理 credentials 和配置

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = join(__dirname, '..', 'data', 'connections');

// 确保目录存在
if (!existsSync(STORAGE_DIR)) {
  mkdirSync(STORAGE_DIR, { recursive: true });
}

const STORAGE_FILE = join(STORAGE_DIR, 'credentials.json');

/**
 * 读取所有存储数据
 */
function readAll() {
  try {
    if (existsSync(STORAGE_FILE)) {
      return JSON.parse(readFileSync(STORAGE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Storage read error:', e);
  }
  return {};
}

/**
 * 写入所有存储数据
 */
function writeAll(data) {
  try {
    writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Storage write error:', e);
    throw e;
  }
}

/**
 * 获取一个 key 的值
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function get(key) {
  const all = readAll();
  return all[key];
}

/**
 * 设置一个 key 的值
 * @param {string} key
 * @param {any} value - null 表示删除
 */
export async function set(key, value) {
  const all = readAll();
  if (value === null) {
    delete all[key];
  } else {
    all[key] = value;
  }
  writeAll(all);
}

/**
 * 获取所有 connections 的状态
 */
export async function getAllConnections() {
  return readAll();
}

/**
 * 清除所有连接数据（慎用）
 */
export async function clearAll() {
  writeAll({});
}
