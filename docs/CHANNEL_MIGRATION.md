# 频道迁移说明

## 执行时间
2026/7/20 23:13:43

## 需要在 Discord 中创建的新频道

- **项目** (CH_PROJECT)
- **产出** (CH_OUTPUT)
- **归档** (CH_ARCHIVE)
- **内容-公众号** (CH_CONTENT_WECHAT)
- **内容-小红书** (CH_CONTENT_XHS)
- **内容-视频号** (CH_CONTENT_VIDEO)
- **内容-X** (CH_CONTENT_X)
- **内容-Newsletter** (CH_CONTENT_NEWSLETTER)
- **提醒** (CH_REMINDER)

## 需要删除/归档的频道

- ~~CH_SALES_LEADS~~
- ~~CH_OPPORTUNITY_SOLUTION~~
- ~~CH_QUOTE~~
- ~~CH_BID~~
- ~~CH_CONTRACT_OPS~~
- ~~CH_PROJECT_MGMT~~
- ~~CH_FDE_DELIVERY~~
- ~~CH_TEST_ACCEPT~~
- ~~CH_CUSTOMER_SUCCESS~~
- ~~CH_INVOICE_AR~~
- ~~CH_OPPORTUNITY~~
- ~~CH_CONTROL_DASH~~
- ~~CH_DEEP_DISCUSSION~~
- ~~CH_AGENT_STATUS~~
- ~~CH_DOMESTIC_MAIN~~
- ~~CH_DAILY_MATERIAL~~
- ~~CH_DOMESTIC_PREVIEW_WECHAT~~
- ~~CH_DOMESTIC_PREVIEW_XHS~~
- ~~CH_DOMESTIC_PREVIEW_VIDEO~~
- ~~CH_DOMESTIC_PREVIEW_DOUYIN~~
- ~~CH_DOMESTIC_PUBLISH_WECHAT~~
- ~~CH_DOMESTIC_PUBLISH_XHS~~
- ~~CH_DOMESTIC_PUBLISH_VIDEO~~
- ~~CH_DOMESTIC_PUBLISH_DOUYIN~~
- ~~CH_OS_MAIN~~
- ~~CH_OS_RAW~~
- ~~CH_OS_PREVIEW_X~~
- ~~CH_OS_PREVIEW_PH~~
- ~~CH_OS_PREVIEW_NEWSLETTER~~
- ~~CH_OS_PREVIEW_YOUTUBE~~
- ~~CH_OS_PREVIEW_LINKEDIN~~
- ~~CH_OS_PUBLISH_X~~
- ~~CH_OS_PUBLISH_PH~~
- ~~CH_OS_PUBLISH_NEWSLETTER~~
- ~~CH_INBOX~~
- ~~CH_OUTBOX~~
- ~~CH_CONTENT_ASSETS~~
- ~~CH_CUSTOMER_DATA~~
- ~~CH_MEMORY_BANK~~
- ~~CH_IDEA_POOL~~
- ~~CH_NEWS_FEED~~
- ~~CH_USAGE_REPORT~~
- ~~CH_BIZ_HR~~
- ~~CH_FILE_COLLECTION~~
- ~~CH_DEV_SOFTWARE~~
- ~~CH_PRODUCT_PLAN~~
- ~~CH_ARCH_REVIEW~~
- ~~CH_TEST_RELEASE~~
- ~~CH_PROD_OPS~~
- ~~CH_ENG_KNOWLEDGE~~
- ~~CH_SEO_GEO~~
- ~~CH_LINK_BUSINESS~~
- ~~CH_MARKETING_GROWTH~~
- ~~CH_MARKET_RESEARCH~~
- ~~CH_OPPORTUNITY_FIND~~
- ~~CH_GROWTH_REVIEW~~

## 保留的频道

- CH_ENTRY
- CH_RSS
- CH_DAILY
- CH_GH
- CH_USAGE
- CH_MEMORY
- CH_IDEAS
- CH_APPROVAL_CENTER
- CH_XIASI

## .env 更新模板

完成频道创建后，在 .env 中添加以下配置：

```
# 项目 - TODO: 创建后填入 ID
# 产出 - TODO: 创建后填入 ID
# 归档 - TODO: 创建后填入 ID
# 内容-公众号 - TODO: 创建后填入 ID
# 内容-小红书 - TODO: 创建后填入 ID
# 内容-视频号 - TODO: 创建后填入 ID
# 内容-X - TODO: 创建后填入 ID
# 内容-Newsletter - TODO: 创建后填入 ID
# 提醒 - TODO: 创建后填入 ID
```

## 执行步骤

1. 在 Discord 中创建新频道
2. 获取新频道的 Channel ID
3. 更新 .env 文件
4. 重启 entry-bot
5. 确认功能正常

## 频道用途说明

### 推送层
- `#资讯`: RSS 资讯聚合，每天 12:00 推送
- `#每日总结`: 工作日报，每天 23:00 推送
- `#每日任务`: GitHub 待办，每天 10:00 推送
- `#用量`: Token 使用报告，每天 12:30 推送

### 项目层
- `#项目`: 所有工作的沉淀容器，AI 自动创建 Project

### 知识层
- `#记忆库`: 长期知识、偏好、决策
- `#灵感`: 点子、想法
- `#产出`: 文档、代码
- `#归档`: 历史项目

### 内容层
- `#内容-*`: 各平台内容分发

### 通知层
- `#审批`: 需要处理的审批
- `#提醒`: 任务到期提醒
- `#告警`: 系统异常

## 数据迁移

旧业务频道的数据建议：
- 销售类 → 迁移到 #项目 下的 Project
- 技术类 → 迁移到 #产出
- 历史项目 → 迁移到 #归档
