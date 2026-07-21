# Demo Case · saas

## 1. 典型场景

- 客户试用免费版；
- 客户查看 Pricing 页面；
- 客户切换到 Pro 套餐（mock）；
- 客户填写 signup 表单（mock）。

## 2. 关键组件

- `Hero`（带 CTA）
- `Pricing`（使用 Card + Button）
- `SignupForm`（FormField + Button + Toast）
- `FeatureList`（Table 或 grid）

## 3. 路由

```text
/             Marketing Home
/pricing      Pricing
/signup       Signup (mock)
/settings     Settings
```

## 4. 数据契约

- Pricing 来源：`src/data/fixtures/pricing.ts`
- Signup 走 `POST /api/signup`（MSW）

## 5. 视觉

- 风格：minimal
- 主色：brand-accent
- 副色：brand-highlight
- 字体：Inter
