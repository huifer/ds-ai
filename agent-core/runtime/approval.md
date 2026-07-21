# Approval Gate 规范

> 任何外部动作必须先经过本规范。  
> 实现位于 `src/runtime/approval.mjs`。  
> AgentManager.dispatch() 在执行需要审批的动作前会 await approval.check(kind, payload)。

---

# 1. 设计目标

- 默认拒绝所有外部动作；
- 显式枚举需要人工审批的 `ApprovalKind`；
- 每个 `ApprovalKind` 关联一个风险等级与默认有效期；
- 同一 `objectId` 的审批结果幂等；
- 任何审批失败 / 超时 / 拒绝都不执行外部动作。

---

# 2. ApprovalKind 枚举

```ts
type ApprovalKind =
  | 'quote-send'              // 报价对外发送
  | 'contract-sign'           // 合同签订
  | 'bid-submit'              // 标书提交
  | 'demo-approve'            // Demo Approve
  | 'publish-domestic'        // 国内平台发布
  | 'publish-overseas'        // 海外平台发布
  | 'prod-deploy'             // 生产部署
  | 'external-file-send'      // 对外发文件
  | 'data-delete'             // 数据删除
  | 'invoice-approval'        // 开票
  | 'payment-remind'          // 付款提醒
  | 'cs-case-study'           // 客户案例发布
  | 'cs-renewal'              // 续费提案
  | 'cs-pricing-change';      // 客户价格变更
```

---

# 3. 风险等级与默认有效期

| ApprovalKind | Risk | 默认有效期 | 渠道 |
|---|---|---|---|
| quote-send | medium | 7 天 | `#审批中心` |
| contract-sign | high | 30 天 | `#审批中心` |
| bid-submit | high | 7 天 | `#审批中心` |
| demo-approve | low | 3 天 | `#fde-客户交付` |
| publish-domestic | medium | 24 小时 | `#审批中心` |
| publish-overseas | medium | 24 小时 | `#审批中心` |
| prod-deploy | high | 1 小时 | `#审批中心` |
| external-file-send | high | 24 小时 | `#审批中心` |
| data-delete | high | 1 小时 | `#审批中心` |
| invoice-approval | medium | 7 天 | `#开票与回款` |
| payment-remind | low | 30 天 | `#开票与回款` |
| cs-case-study | medium | 30 天 | `#客户成功` |
| cs-renewal | medium | 14 天 | `#客户成功` |
| cs-pricing-change | high | 7 天 | `#审批中心` |

---

# 4. 数据结构

```ts
type Approval = {
  id: string;                // APR-2026-0001
  kind: ApprovalKind;
  producer: AgentId;          // 申请 Agent
  objectId: string;           // 关联对象
  summary: string;
  evidence: string[];         // 链接 / 路径 / commit
  risk: 'low' | 'medium' | 'high';
  expiresAt: string;          // ISO
  channel: string;
  buttons: ('approve' | 'reject' | 'changes' | 'defer')[];
  createdAt: string;
  decisionAt?: string;
  decisionBy?: string;        // 用户 ID
  decision?: 'approve' | 'reject' | 'defer';
  note?: string;
};
```

---

# 5. 接口

```ts
class Approval {
  async check(kind: ApprovalKind, payload: Partial<Approval>): Promise<{ status: 'OK' | 'REJECTED' | 'EXPIRED'; approval?: Approval }>;
  async grant(id: string, decision: 'approve' | 'reject' | 'defer', userId: string, note?: string): Promise<void>;
  async list(opts?: { kind?: ApprovalKind; status?: 'pending' | 'decided' }): Promise<Approval[]>;
  async expire(): Promise<number>;  // 回收过期
}
```

---

# 6. 状态机

```text
PENDING → APPROVED → EXECUTED
PENDING → REJECTED
PENDING → DEFERRED
PENDING → EXPIRED (timeout)
```

- `EXECUTED` 在 Agent 真正执行外部动作后由 `Publisher` 或 `Delivery` 写回；
- `DEFERRED` 不代表拒绝，可以再次升级到 `PENDING`；
- `EXPIRED` 不可重新激活，必须新建审批。

---

# 7. AgentManager 集成

```ts
const route = lookupRoute(cmd.name, cmd.sub);
if (route.approval) {
  const result = await approval.check(route.approval, {
    producer: route.agentId,
    objectId: cmd.args._id ?? deriveObjectId(cmd),
    summary: `${cmd.name} ${cmd.sub} ${JSON.stringify(cmd.args)}`,
    risk: defaultRisk(route.approval),
  });
  if (result.status === 'OK') {
    return this.call(route.agentId, route.skill, payload);
  }
  if (result.status === 'REJECTED' || result.status === 'EXPIRED') {
    return { status: 'NEED_APPROVAL', approvalKind: route.approval };
  }
}
```

---

# 8. 按钮回调

| customId | action | 触发 |
|---|---|---|
| `card-approve:<objectId>` | grant(id, 'approve') | 推进 stage / 触发 publish |
| `card-reject:<objectId>` | grant(id, 'reject') | 状态回到 previous stage |
| `card-defer:<objectId>` | grant(id, 'defer') | 候选入池 |

按钮交互通过 `extensions/discord-tools.mjs` 的 `discord_dispatch_button` 工具派发。

---

# 9. 持久化

```text
data/agent-runtime/approvals/YYYY-MM-DD.jsonl
```

每条记录含 `createdAt / decisionAt / decisionBy / evidence / risk / channel`。

---

# 10. 测试

- 同 `objectId` + `kind` 二次 approve → 幂等返回第一次的 result；
- 过期后自动 `EXPIRED`；
- `REJECTED` 不调用外部动作；
- 高风险动作必须 30 分钟内人工处理。

---

# 11. 下一项

实现 `src/runtime/approval.mjs`：

1. 枚举 `ApprovalKind` 与默认 risk / expiresAt / channel；
2. 持久化 `data/agent-runtime/approvals/`；
3. `check` / `grant` / `list` / `expire` 接口；
4. 与 AgentManager 集成；
5. 单元测试。

完成后 Day 3 任务结束。
