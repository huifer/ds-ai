---
name: pnpm-install
description: |
  Use this skill when installing dependencies for a React project.
  Always pair with `react-vite`.
---

# 1. 安装

```bash
pnpm install
```

# 2. 添加依赖

```bash
pnpm add @tanstack/react-query react-router-dom zod zustand
pnpm add -D tailwindcss@4 @tailwindcss/vite msw vitest @testing-library/react
```

# 3. 锁文件

`pnpm-lock.yaml` 必须提交。

# 4. Node

`engines.node` 至少 `>=20`。

# 5. 失败回退

- `pnpm install` 失败 → 切回 npm；
- 缺包 → 检查 `package.json` 与 `pnpm-lock.yaml`。
