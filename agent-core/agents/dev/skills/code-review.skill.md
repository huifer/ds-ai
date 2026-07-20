---
name: code-review
agent: dev
description: |
  Synthetic agent skill for dev: code-review.
  Auto-generated.
---

# Code Review（代码评审）

## 1. 触发
- 用户贴代码请求评审
- PR / MR 通知
- 主动审查关键模块

## 2. 评审维度
- **正确性**: 逻辑是否对,边界是否处理
- **可读性**: 命名 / 注释 / 结构
- **可维护性**: 模块化 / 耦合度
- **性能**: 时间复杂度 / 内存 / I/O
- **安全**: 注入 / XSS / 认证 / 授权
- **测试**: 覆盖率 / 边界测试
- **文档**: README / 注释 / 变更日志

## 3. 反馈格式
```
## 📋 评审总结
- 整体评价: ...
- 阻塞问题: N 个
- 建议项: M 个

## 🚨 阻塞(必须改)
1. ...
2. ...

## 💡 建议(可优化)
- ...
- ...

## ✨ 亮点
- ...
```

## 4. 输出
data/business/code-reviews/<file>-<date>.md
