#!/usr/bin/env node
/**
 * 🧪 记忆系统完整测试
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(homedir(), 'pi-discord-agents');

async function testMemory() {
  console.log('=== 记忆系统测试 ===\n');
  
  try {
    const { createMemoryStore } = await import(`${ROOT}/src/memory-store.mjs`);
    
    console.log('1. 创建记忆存储...');
    // createMemoryStore 是 async 函数
    const memoryStore = await createMemoryStore({ rootDir: ROOT });
    console.log(`   ✓ memoryStore 创建成功`);
    console.log(`   类型: ${typeof memoryStore}`);
    console.log(`   方法: ${Object.keys(memoryStore).join(', ')}`);
    
    console.log('\n2. 测试 stats...');
    if (typeof memoryStore.stats === 'function') {
      const stats = memoryStore.stats();
      console.log(`   ✓ stats: ${JSON.stringify(stats)}`);
    } else {
      console.log('   ⚠ stats 不是函数');
    }
    
    console.log('\n3. 测试 query...');
    if (typeof memoryStore.query === 'function') {
      const allMemories = await memoryStore.query({});
      console.log(`   ✓ query() 返回 ${allMemories.items?.length || 0} 条记忆`);
      
      if (allMemories.items && allMemories.items.length > 0) {
        console.log('\n4. 记忆详情:');
        for (const item of allMemories.items.slice(0, 5)) {
          console.log(`   - ${item.id}: ${item.subject?.slice(0, 30) || '无主题'}`);
        }
      }
      
      console.log('\n5. 测试按 kind 查询...');
      const kinds = ['preference', 'decision', 'idea', 'constraint'];
      for (const kind of kinds) {
        const result = await memoryStore.query({ kind });
        console.log(`   ${kind}: ${result.items?.length || 0} 条`);
      }
    } else {
      console.log('   ⚠ query 不是函数');
    }
    
    console.log('\n6. 测试 upsert...');
    if (typeof memoryStore.upsert === 'function') {
      const testMemory = {
        id: `test_${Date.now()}`,
        kind: 'idea',
        subject: '测试记忆',
        content: '这是一个测试记忆',
        confidence: 0.9,
        tags: ['test'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await memoryStore.upsert(testMemory);
      console.log('   ✓ upsert 成功');
      
      // 查询验证
      const newResult = await memoryStore.query({ kind: 'idea' });
      const found = newResult.items?.find(i => i.id === testMemory.id);
      console.log(`   ✓ 验证: ${found ? '找到' : '未找到'}`);
      
      // 删除测试记忆
      await memoryStore.revoke(testMemory.id);
      console.log('   ✓ revoke 成功');
    } else {
      console.log('   ⚠ upsert 不是函数');
    }
    
    console.log('\n✅ 记忆系统测试完成');
    
  } catch (e) {
    console.error('❌ 记忆系统测试失败:', e.message);
    console.error(e.stack);
  }
}

testMemory();
