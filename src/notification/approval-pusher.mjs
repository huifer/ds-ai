// ~/pi-discord-agents/src/notification/approval-pusher.mjs
// 审批推送器

/**
 * 审批类型
 */
export const APPROVAL_TYPES = {
  QUOTE: {
    id: 'quote',
    label: '报价单',
    icon: '💰',
    urgent: 'medium',
  },
  CONTRACT: {
    id: 'contract',
    label: '合同',
    icon: '📜',
    urgent: 'high',
  },
  PUBLISH: {
    id: 'publish',
    label: '内容发布',
    icon: '📤',
    urgent: 'high',
  },
  DEMO: {
    id: 'demo',
    label: 'Demo 交付',
    icon: '🎯',
    urgent: 'low',
  },
  DISCOUNT: {
    id: 'discount',
    label: '折扣审批',
    icon: '🏷️',
    urgent: 'high',
  },
  BID: {
    id: 'bid',
    label: '投标提交',
    icon: '🏆',
    urgent: 'high',
  },
};

/**
 * 审批卡片生成器
 */
export class ApprovalPusher {
  constructor({ discord, channelId, log = () => {} }) {
    this.discord = discord;
    this.channelId = channelId;
    this.log = log;
  }

  /**
   * 推送审批请求
   */
  async push(approval) {
    const { type, title, content, actions, relatedId, metadata = {} } = approval;
    
    const typeInfo = APPROVAL_TYPES[type] || { id: type, label: type, icon: '📋' };
    
    // 生成卡片
    const card = this.generateCard({
      typeInfo,
      title,
      content,
      actions,
      relatedId,
      metadata,
    });

    // 发送到审批频道
    try {
      const message = await this.discord.send(this.channelId, card);
      
      // 添加按钮反应
      if (actions?.length > 0) {
        for (const action of actions) {
          await this.discord.react(message, action.emoji);
        }
      }

      this.log(`[approval] 已推送: ${type} - ${title}`);
      return { ok: true, messageId: message?.id };
    } catch (e) {
      this.log(`[approval] 推送失败: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  /**
   * 生成审批卡片
   */
  generateCard({ typeInfo, title, content, actions, relatedId, metadata }) {
    const timestamp = new Date().toLocaleString('zh-CN');
    const urgentEmoji = typeInfo.urgent === 'high' ? '🔴' : typeInfo.urgent === 'medium' ? '🟡' : '🟢';

    let card = `## ${typeInfo.icon} ${urgentEmoji} 需要审批: ${typeInfo.label}\n\n`;
    card += `**标题**: ${title}\n\n`;
    
    if (content) {
      card += `**内容**:\n${content}\n\n`;
    }

    if (metadata.amount) {
      card += `**金额**: ¥${metadata.amount.toLocaleString()}\n`;
    }
    if (metadata.customer) {
      card += `**客户**: ${metadata.customer}\n`;
    }
    if (metadata.platform) {
      card += `**平台**: ${metadata.platform}\n`;
    }
    
    card += `\n**时间**: ${timestamp}\n`;
    
    if (relatedId) {
      card += `**关联ID**: \`${relatedId}\`\n`;
    }

    card += `\n---\n`;

    // 操作按钮
    if (actions?.length > 0) {
      card += `**操作**:\n`;
      for (const action of actions) {
        card += `${action.emoji} \`${action.label}\`  `;
      }
      card += '\n\n_点击对应表情进行操作_';
    }

    return card;
  }

  /**
   * 生成报价审批卡片
   */
  async pushQuote({ quoteId, customer, amount, projectTitle, quoteContent }) {
    return await this.push({
      type: 'quote',
      title: projectTitle || `报价单 ${quoteId}`,
      content: quoteContent || '',
      relatedId: quoteId,
      metadata: { customer, amount },
      actions: [
        { emoji: '✅', label: '批准', action: 'approve' },
        { emoji: '✏️', label: '修改', action: 'edit' },
        { emoji: '❌', label: '拒绝', action: 'reject' },
      ],
    });
  }

  /**
   * 生成合同审批卡片
   */
  async pushContract({ contractId, customer, amount, projectTitle, riskLevel }) {
    return await this.push({
      type: 'contract',
      title: projectTitle || `合同 ${contractId}`,
      content: riskLevel === 'high' ? '⚠️ 高风险合同，请仔细审核' : '',
      relatedId: contractId,
      metadata: { customer, amount, riskLevel },
      actions: [
        { emoji: '✅', label: '批准', action: 'approve' },
        { emoji: '✏️', label: '修改', action: 'edit' },
        { emoji: '❌', label: '拒绝', action: 'reject' },
      ],
    });
  }

  /**
   * 生成内容发布审批卡片
   */
  async pushPublish({ contentId, title, platform, previewUrl }) {
    return await this.push({
      type: 'publish',
      title,
      content: previewUrl ? `[预览链接](${previewUrl})` : '',
      relatedId: contentId,
      metadata: { platform },
      actions: [
        { emoji: '✅', label: '发布', action: 'approve' },
        { emoji: '✏️', label: '修改', action: 'edit' },
        { emoji: '❌', label: '取消', action: 'reject' },
      ],
    });
  }

  /**
   * 生成折扣审批卡片
   */
  async pushDiscount({ quoteId, originalAmount, discountAmount, finalAmount, reason }) {
    return await this.push({
      type: 'discount',
      title: `折扣申请: ${quoteId}`,
      content: `申请理由: ${reason}`,
      relatedId: quoteId,
      metadata: {
        originalAmount,
        discountAmount,
        finalAmount,
      },
      actions: [
        { emoji: '✅', label: '批准折扣', action: 'approve' },
        { emoji: '❌', label: '拒绝', action: 'reject' },
      ],
    });
  }
}
