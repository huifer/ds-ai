# Zenbuild Design System

> 统一所有 Demo / MVP / 内部工具的视觉与组件规范。  
> Token 文件：`agent-core/design/tokens.css`。  
> 组件源码：`agent-core/design/components/<name>/`。

---

# 1. 设计原则

- 一致性优先于新颖性；
- Token 必须唯一来源；
- 业务文档与代码示例同步更新；
- 任何新增组件必须能跨 Demo / MVP 复用。

# 2. 设计 Token

颜色、字号、间距、圆角、阴影、字体集中在 `tokens.css`。

Demo 项目通过：

```ts
import '@zenbuild/design/tokens.css';
```

或复制 token 到自己的 Tailwind 配置：

```ts
// tailwind.config.js
import { tokens } from '@zenbuild/design/tokens';
export default {
  theme: {
    extend: {
      colors: tokens.colors,
      borderRadius: tokens.radii,
      fontFamily: tokens.fonts,
    },
  },
};
```

# 3. 组件清单

| 组件 | 路径 | 变体 |
|---|---|---|
| Button | `components/button/` | primary / accent / outline / ghost / danger / size: sm/md/lg |
| Card | `components/card/` | flat / outlined / elevated |
| Table | `components/table/` | plain / striped / bordered |
| Form Field | `components/form/` | text / number / select / checkbox / radio |
| Modal | `components/modal/` | sm / md / lg / fullscreen |
| Chart | `components/chart/` | line / bar / pie / area |
| Hero | `components/hero/` | left / center / split |
| Nav | `components/nav/` | top / side / breadcrumb |
| TableOfContents | `components/table-of-contents/` | sidebar / top |
| Breadcrumb | `components/breadcrumb/` | — |
| Toast | `components/toast/` | info / success / warn / danger |
| Tooltip | `components/tooltip/` | top / bottom / left / right |

每个组件都包含：

- `<Component />` 源码；
- `index.ts` 对外导出；
- `*.stories.tsx` Storybook 故事（可选）；
- `*.test.tsx` 单元测试（推荐）。

# 4. 命名约定

- 文件名 `kebab-case.tsx`；
- 组件名 `PascalCase.tsx`；
- Props 类型 `ComponentNameProps`；
- 变体通过 `variant` prop，不通过 className。

# 5. 国际化

组件默认使用 `i18n` key + `t()` 函数，不写死中文或英文。

# 6. 主题

- 浅色（默认）；
- 深色（CSS 变量覆盖）；
- 高对比（无障碍）。

# 7. 无障碍

- WCAG 2.1 AA 颜色对比；
- 所有交互元素必须支持键盘；
- ARIA 属性按 WAI-ARIA 1.2；
- 表单必须可读屏。

# 8. 变更流程

1. 在 `agent-core/design/components/<name>/` 新建或修改；
2. 同步更新 token 与 README；
3. 在 Demo 项目 `npm run test` 验证；
4. 在 Demo 项目的 `package.json` bump `@zenbuild/design` 版本。

# 9. 何时新增组件

- 同一功能在 ≥ 2 个 Demo 中重复实现；
- 同一交互（按钮、卡片、表单）出现 ≥ 5 次；
- 业务方明确要求新交互。

# 10. 不做

- 不允许 Demo 项目自创通用组件；
- 不允许 Demo 项目改 token；
- 不允许使用 Tailwind 之外的原子化 CSS 库。
