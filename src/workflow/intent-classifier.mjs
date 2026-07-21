// ~/pi-discord-agents/src/workflow/intent-classifier.mjs
// 意图分类器 - AI 判断用户意图，决定是否创建 Project

/**
 * 意图类型
 */
export const INTENT_TYPES = {
  INSTANT: 'instant',      // 即时任务，直接回复
  PROJECT: 'project',       // 需要创建 Project
  APPROVAL: 'approval',     // 需要审批
  QUERY: 'query',           // 查询类
};

/**
 * Project 类型关键词
 */
const TECH_KEYWORDS = [
  '做个', '写个', '开发', '帮我做', '帮我写',
  '代码', '网站', '应用', '机器人', '脚本',
  'api', '接口', '部署', '架构', 'app', '小程序',
  '写代码', '编程', '写个脚本', '做个网站',
];

const SALES_KEYWORDS = [
  '客户', '公司', '预算', '报价', '合作',
  '商机', '需求', '解决方案', '想做', '有个客户',
  '意向', '跟进', '订单', '合同',
];

const CONTENT_KEYWORDS = [
  '写一篇', '写个文章', '写文章', '拍个视频', '做个视频', '做个文章',
  '发个推文', '发个文章', '小红书', '公众号', '内容', '文案', '脚本',
  '帮我写', '创作', '发布', '文章', '笔记',
];

const DELIVERY_KEYWORDS = [
  '交付', '实施', '部署', '上线', '培训',
  'poc', '客户现场', '驻场', '演示', '验收',
];

/**
 * 显式创建 Project 的关键词
 */
const EXPLICIT_PROJECT_KEYWORDS = [
  '开个新项目', '创建项目', '这是', '项目',
  '开始', '项目名', '项目叫做',
];

/**
 * 需要审批的关键词
 */
const APPROVAL_KEYWORDS = [
  '批准', 'approve', '确认', '确认发布',
  '确认报价', '确认合同',
];

/**
 * 查询类关键词
 */
const QUERY_KEYWORDS = [
  '看看', '查看', '查看一下', '查一下',
  '有什么', '有哪些', '多少', '几个',
  '状态', '进度', '情况',
];

/**
 * 意图分类器
 */
export class IntentClassifier {
  constructor({ log = () => {} } = {}) {
    this.log = log;
  }

  /**
   * 分类用户意图
   * @param {string} message - 用户消息
   * @param {object} context - 上下文（对话轮数、session 等）
   * @returns {object} { type, reason, projectType, confidence }
   */
  async classify(message, context = {}) {
    const text = message.trim();
    const lowerText = text.toLowerCase();

    // 1. 检查是否需要审批
    if (this.containsAny(lowerText, APPROVAL_KEYWORDS)) {
      return {
        type: INTENT_TYPES.APPROVAL,
        reason: '检测到审批关键词',
        confidence: 0.9,
      };
    }

    // 2. 检查是否查询类
    if (this.isQuery(text, context)) {
      return {
        type: INTENT_TYPES.QUERY,
        reason: '查询类请求',
        confidence: 0.8,
      };
    }

    // 3. 检查是否显式要求创建 Project
    if (this.isExplicitProject(text)) {
      const projectType = this.detectProjectType(text);
      return {
        type: INTENT_TYPES.PROJECT,
        reason: '显式创建项目',
        projectType,
        confidence: 0.95,
      };
    }

    // 4. 检查是否隐式需要创建 Project
    const shouldCreateProject = this.shouldImplicitlyCreateProject(text, context);
    if (shouldCreateProject.should) {
      return {
        type: INTENT_TYPES.PROJECT,
        reason: shouldCreateProject.reason,
        projectType: shouldCreateProject.projectType,
        confidence: shouldCreateProject.confidence,
      };
    }

    // 5. 默认即时任务
    return {
      type: INTENT_TYPES.INSTANT,
      reason: '简单任务或闲聊',
      confidence: 0.7,
    };
  }

  /**
   * 检测是否是显式创建 Project
   */
  isExplicitProject(text) {
    // 检查是否包含项目相关关键词
    for (const keyword of EXPLICIT_PROJECT_KEYWORDS) {
      if (text.includes(keyword)) return true;
    }

    // 检查是否明确说"做个 xxx"、"帮我做 xxx"、"帮我写 xxx" 等
    if (/^(帮我|给我)?做个/.test(text)) return true;
    if (/^(帮我|给我)?写(个|一)?/.test(text)) return true;  // 写个、写一篇
    if (/^(帮我|给我)?开发/.test(text)) return true;

    return false;
  }

  /**
   * 检测 Project 类型
   */
  detectProjectType(text) {
    const lowerText = text.toLowerCase();

    // 技术类
    if (this.containsAny(lowerText, TECH_KEYWORDS)) {
      return 'tech';
    }

    // 内容类
    if (this.containsAny(lowerText, CONTENT_KEYWORDS)) {
      return 'content';
    }

    // 销售类
    if (this.containsAny(lowerText, SALES_KEYWORDS)) {
      return 'sales';
    }

    // 交付类
    if (this.containsAny(lowerText, DELIVERY_KEYWORDS)) {
      return 'delivery';
    }

    // 默认技术类
    return 'tech';
  }

  /**
   * 判断是否隐式需要创建 Project
   */
  shouldImplicitlyCreateProject(text, context) {
    const lowerText = text.toLowerCase();

    // 对话轮数过多
    if ((context.turnCount ?? 0) >= 10) {
      return {
        should: true,
        reason: '对话轮数超过 10 轮',
        projectType: this.detectProjectType(text),
        confidence: 0.7,
      };
    }

    // 包含多个文档需求
    const docKeywords = ['prd', '报价', '方案', '合同', '文档'];
    const docCount = docKeywords.filter(k => lowerText.includes(k)).length;
    if (docCount >= 2) {
      return {
        should: true,
        reason: '需要生成多个文档',
        projectType: this.detectProjectType(text),
        confidence: 0.85,
      };
    }

    // 包含客户+需求
    const hasCustomer = this.containsAny(lowerText, ['客户', '公司']);
    const hasNeed = this.containsAny(lowerText, ['想', '需要', '做', '开发']);
    if (hasCustomer && hasNeed) {
      return {
        should: true,
        reason: '包含客户和需求',
        projectType: 'sales',
        confidence: 0.8,
      };
    }

    // 包含预算
    const hasBudget = /(\d+\s*万|\d+\s*k|预算)/.test(text);
    if (hasBudget && hasNeed) {
      return {
        should: true,
        reason: '包含预算和需求',
        projectType: 'sales',
        confidence: 0.75,
      };
    }

    return { should: false };
  }

  /**
   * 判断是否是查询类
   */
  isQuery(text, context) {
    const lowerText = text.toLowerCase();
    return this.containsAny(lowerText, QUERY_KEYWORDS);
  }

  /**
   * 检查文本是否包含任意关键词
   */
  containsAny(text, keywords) {
    return keywords.some(k => text.includes(k.toLowerCase()));
  }

  /**
   * 生成 Project 标题
   */
  async generateTitle(message, projectType) {
    // 简单的标题生成逻辑
    let title = '';

    // 尝试提取主题
    const patterns = [
      /做个?(.+)/,
      /写个?(.+)/,
      /开发(.+)/,
      /做个(.+)/,
      /帮我(.+)/,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        title = match[1].trim();
        break;
      }
    }

    // 如果没匹配到，用消息前 20 个字符
    if (!title) {
      title = message.slice(0, 20).replace(/\n/g, ' ').trim();
    }

    // 根据类型添加前缀
    const prefixes = {
      tech: '开发-',
      sales: '销售-',
      content: '创作-',
      delivery: '交付-',
    };

    title = (prefixes[projectType] || '') + title;

    return title;
  }
}
