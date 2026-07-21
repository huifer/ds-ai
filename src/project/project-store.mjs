// ~/pi-discord-agents/src/project/project-store.mjs
// Project 数据持久化存储

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Project 存储
 * 使用 YAML 格式存储，每个 Project 一个文件
 */
export class ProjectStore {
  constructor({ rootDir }) {
    this.rootDir = rootDir ?? join(__dirname, '../../data/projects');
    this.ensureDir(this.rootDir);
  }

  /**
   * 确保目录存在
   */
  ensureDir(dir) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 获取 Project 文件路径
   */
  getProjectPath(id) {
    return join(this.rootDir, `${id}.yaml`);
  }

  /**
   * 创建 Project
   */
  async create(data) {
    const id = data.id;
    const path = this.getProjectPath(id);
    
    if (existsSync(path)) {
      throw new Error(`Project ${id} already exists`);
    }

    const project = {
      ...data,
      createdAt: data.createdAt ?? new Date().toISOString(),
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    };

    this.writeProject(path, project);
    return project;
  }

  /**
   * 获取 Project
   */
  async get(id) {
    const path = this.getProjectPath(id);
    if (!existsSync(path)) {
      return null;
    }
    return this.readProject(path);
  }

  /**
   * 更新 Project
   */
  async update(id, data) {
    const path = this.getProjectPath(id);
    const existing = await this.get(id);
    
    if (!existing) {
      throw new Error(`Project ${id} not found`);
    }

    const updated = {
      ...existing,
      ...data,
      id, // 确保 ID 不变
      updatedAt: new Date().toISOString(),
    };

    this.writeProject(path, updated);
    return updated;
  }

  /**
   * 删除 Project
   */
  async delete(id) {
    const path = this.getProjectPath(id);
    if (!existsSync(path)) {
      return false;
    }
    const { unlinkSync } = await import('node:fs');
    unlinkSync(path);
    return true;
  }

  /**
   * 列出所有 Project
   */
  async list(filters = {}) {
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(this.rootDir).filter(f => f.endsWith('.yaml'));
    
    const projects = [];
    for (const file of files) {
      const project = this.readProject(join(this.rootDir, file));
      if (project) {
        if (this.matchFilters(project, filters)) {
          projects.push(project);
        }
      }
    }

    // 排序：按更新时间倒序
    projects.sort((a, b) => 
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );

    return projects;
  }

  /**
   * 检查 filters 是否匹配
   */
  matchFilters(project, filters) {
    if (filters.status && project.meta?.status !== filters.status) {
      return false;
    }
    if (filters.type && project.type !== filters.type) {
      return false;
    }
    if (filters.createdBy && project.meta?.createdBy !== filters.createdBy) {
      return false;
    }
    return true;
  }

  /**
   * 读取 Project 文件
   */
  readProject(path) {
    try {
      const content = readFileSync(path, 'utf8');
      return this.parseYaml(content);
    } catch (e) {
      console.error(`Failed to read project: ${path}`, e.message);
      return null;
    }
  }

  /**
   * 写入 Project 文件
   */
  writeProject(path, project) {
    const content = this.stringifyYaml(project);
    writeFileSync(path, content, 'utf8');
  }

  /**
   * 简单的 YAML 解析（不支持复杂结构）
   */
  parseYaml(content) {
    const lines = content.split('\n');
    const result = {};
    let currentKey = null;
    let currentIndent = 0;
    const stack = [{ obj: result, indent: -1 }];

    for (const line of lines) {
      if (!line.trim() || line.trim().startsWith('#')) continue;

      const indent = line.search(/\S/);
      const trimmed = line.trim();

      // 回到正确的层级
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1].obj;

      if (trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':');
        const keyName = key.trim();
        const value = valueParts.join(':').trim();

        if (value === '') {
          // 嵌套对象
          parent[keyName] = {};
          stack.push({ obj: parent[keyName], indent });
        } else {
          // 键值对
          parent[keyName] = this.parseValue(value);
        }
      }
    }

    return result;
  }

  /**
   * 解析 YAML 值
   */
  parseValue(value) {
    // 去除引号
    value = value.replace(/^["']|["']$/g, '');
    
    // 布尔值
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // 数字
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
    
    // 数组
    if (value.startsWith('[') && value.endsWith(']')) {
      return value.slice(1, -1).split(',').map(v => v.trim()).filter(Boolean);
    }
    
    return value;
  }

  /**
   * 简单 YAML 序列化
   */
  stringifyYaml(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    const lines = [];

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;

      if (typeof value === 'object' && !Array.isArray(value)) {
        lines.push(`${spaces}${key}:`);
        lines.push(...this.stringifyYaml(value, indent + 1).split('\n'));
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${spaces}${key}: []`);
        } else {
          lines.push(`${spaces}${key}:`);
          for (const item of value) {
            if (typeof item === 'object') {
              lines.push(`${spaces}  -`);
              lines.push(...this.stringifyYaml(item, indent + 2).split('\n'));
            } else {
              lines.push(`${spaces}  - ${item}`);
            }
          }
        }
      } else {
        let strValue = String(value);
        // 如果值包含特殊字符，加引号
        if (strValue.includes(':') || strValue.includes('#') || strValue.includes('\n')) {
          strValue = `"${strValue.replace(/"/g, '\\"')}"`;
        }
        lines.push(`${spaces}${key}: ${strValue}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 获取子项存储路径
   */
  getSubItemsDir(projectId) {
    const dir = join(this.rootDir, projectId, 'sub-items');
    this.ensureDir(dir);
    return dir;
  }

  /**
   * 创建子项
   */
  async createSubItem(projectId, item) {
    const dir = this.getSubItemsDir(projectId);
    const path = join(dir, `${item.id}.yaml`);
    
    if (existsSync(path)) {
      throw new Error(`SubItem ${item.id} already exists`);
    }

    const content = {
      ...item,
      projectId,
      createdAt: item.createdAt ?? new Date().toISOString(),
    };

    this.writeProject(path, content);
    return content;
  }

  /**
   * 获取子项
   */
  async getSubItem(projectId, itemId) {
    const path = join(this.getSubItemsDir(projectId), `${itemId}.yaml`);
    if (!existsSync(path)) {
      return null;
    }
    return this.readProject(path);
  }

  /**
   * 更新子项
   */
  async updateSubItem(projectId, itemId, data) {
    const existing = await this.getSubItem(projectId, itemId);
    if (!existing) {
      throw new Error(`SubItem ${itemId} not found`);
    }

    const updated = {
      ...existing,
      ...data,
      id: itemId,
      projectId,
      updatedAt: new Date().toISOString(),
    };

    const path = join(this.getSubItemsDir(projectId), `${itemId}.yaml`);
    this.writeProject(path, updated);
    return updated;
  }

  /**
   * 删除子项
   */
  async deleteSubItem(projectId, itemId) {
    const path = join(this.getSubItemsDir(projectId), `${itemId}.yaml`);
    if (!existsSync(path)) {
      return false;
    }
    const { unlinkSync } = await import('node:fs');
    unlinkSync(path);
    return true;
  }

  /**
   * 列出项目的所有子项
   */
  async listSubItems(projectId, filters = {}) {
    const dir = join(this.rootDir, projectId, 'sub-items');
    if (!existsSync(dir)) {
      return [];
    }

    const { readdirSync } = await import('node:fs');
    const files = readdirSync(dir).filter(f => f.endsWith('.yaml'));
    
    const items = [];
    for (const file of files) {
      const item = this.readProject(join(dir, file));
      if (item) {
        if (filters.type && item.type !== filters.type) {
          continue;
        }
        items.push(item);
      }
    }

    // 排序：按创建时间倒序
    items.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    return items;
  }
}

/**
 * 生成唯一 ID
 */
export function generateProjectId() {
  const now = new Date();
  const year = now.getFullYear();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 6);
  return `PRJ-${year}-${dateStr}-${random}`;
}

/**
 * 生成子项 ID
 */
export function generateSubItemId(type) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 4);
  return `${type}-${timestamp}-${random}`;
}
