---
name: debug
agent: dev
description: |
  Synthetic agent skill for dev: debug.
  Auto-generated.
---

# Debug（调试）

## 1. 收集信息
- 错误现象(报错信息 / 截图 / 日志)
- 复现步骤
- 预期行为 vs 实际
- 环境(OS / Node 版本 / 依赖版本)

## 2. 假设驱动
列出 3-5 个可能原因,按概率排序。

## 3. 验证
对每个假设:
- 检查相关代码
- 加日志 / breakpoint
- 单元测试

## 4. 修复
最小改动,优先 root cause 而非 patch。

## 5. 防止复发
- 加单元测试
- 加 lint 规则
- 写 postmortem
