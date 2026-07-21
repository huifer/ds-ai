// ~/pi-discord-agents/src/runtime/approval.mjs
// 审批门禁：枚举 ApprovalKind、check / grant / list / expire 接口。
// 持久化到 data/agent-runtime/approvals/YYYY-MM-DD.jsonl。

import { mkdirSync, existsSync, appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const KINDS = {
  'quote-send':          { risk: 'medium', ttlHours: 24 * 7, channel: 'CH_APPROVAL_CENTER' },
  'contract-sign':       { risk: 'high',   ttlHours: 24 * 30, channel: 'CH_APPROVAL_CENTER' },
  'bid-submit':          { risk: 'high',   ttlHours: 24 * 7, channel: 'CH_APPROVAL_CENTER' },
  'demo-approve':        { risk: 'low',    ttlHours: 24 * 3, channel: 'CH_FDE_DELIVERY' },
  'publish-domestic':    { risk: 'medium', ttlHours: 24, channel: 'CH_APPROVAL_CENTER' },
  'publish-overseas':    { risk: 'medium', ttlHours: 24, channel: 'CH_APPROVAL_CENTER' },
  'prod-deploy':         { risk: 'high',   ttlHours: 1, channel: 'CH_APPROVAL_CENTER' },
  'external-file-send':  { risk: 'high',   ttlHours: 24, channel: 'CH_APPROVAL_CENTER' },
  'data-delete':         { risk: 'high',   ttlHours: 1, channel: 'CH_APPROVAL_CENTER' },
  'invoice-approval':    { risk: 'medium', ttlHours: 24 * 7, channel: 'CH_INVOICE_AR' },
  'payment-remind':      { risk: 'low',    ttlHours: 24 * 30, channel: 'CH_INVOICE_AR' },
  'cs-case-study':       { risk: 'medium', ttlHours: 24 * 30, channel: 'CH_CUSTOMER_SUCCESS' },
  'cs-renewal':          { risk: 'medium', ttlHours: 24 * 14, channel: 'CH_CUSTOMER_SUCCESS' },
  'cs-pricing-change':   { risk: 'high',   ttlHours: 24 * 7, channel: 'CH_APPROVAL_CENTER' },
};

let counter = 0;

export class Approval {
  constructor({ root, baseDir = 'data/agent-runtime/approvals' } = {}) {
    this.root = root ?? process.cwd();
    this.baseDir = resolve(this.root, baseDir);
  }

  configFor(kind) {
    return KINDS[kind] ?? null;
  }

  pathFor(date = new Date()) {
    const ymd = date.toISOString().slice(0, 10);
    return resolve(this.baseDir, `${ymd}.jsonl`);
  }

  async ensureDir(p) {
    const dir = resolve(p, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  nextId() {
    counter += 1;
    const ymd = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `APR-${ymd}-${String(counter).padStart(4, '0')}`;
  }

  async create({ kind, producer, objectId, summary, evidence = [], risk, channel }) {
    const cfg = this.configFor(kind);
    if (!cfg) throw new Error(`unknown approval kind: ${kind}`);
    const record = {
      id: this.nextId(),
      kind,
      producer,
      objectId,
      summary,
      evidence,
      risk: risk ?? cfg.risk,
      channel: channel ?? cfg.channel,
      ttlHours: cfg.ttlHours,
      expiresAt: new Date(Date.now() + cfg.ttlHours * 3600 * 1000).toISOString(),
      status: 'PENDING',
      buttons: ['approve', 'reject', 'defer'],
      createdAt: new Date().toISOString(),
    };
    const path = this.pathFor();
    await this.ensureDir(path);
    appendFileSync(path, JSON.stringify(record) + '\n', 'utf8');
    return record;
  }

  async check(kind, payload) {
    const cfg = this.configFor(kind);
    if (!cfg) return { status: 'REJECTED', reason: 'UNKNOWN_KIND' };
    // 先查找是否已有相同 kind + objectId 的已批准记录
    const approved = await this.list({ kind, status: 'APPROVED' });
    const foundApproved = approved.find((r) => r.objectId === payload.objectId);
    if (foundApproved) {
      return { status: 'APPROVED', approval: foundApproved };
    }
    // 检查是否有已拒绝记录
    const rejected = await this.list({ kind, status: 'REJECTED' });
    const foundRejected = rejected.find((r) => r.objectId === payload.objectId);
    if (foundRejected) {
      return { status: 'REJECTED', approval: foundRejected };
    }
    // 创建新的审批请求
    return {
      status: 'NEED_APPROVAL',
      approval: await this.create({ kind, ...payload }),
    };
  }

  async grant(id, decision, userId, note) {
    // 跨日查找记录
    for (const file of this.listFiles()) {
      const path = resolve(this.baseDir, file);
      const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
      const out = [];
      let touched = false;
      for (const line of lines) {
        const rec = JSON.parse(line);
        if (rec.id === id && rec.status === 'PENDING') {
          rec.status = decision === 'approve' ? 'APPROVED' : decision === 'reject' ? 'REJECTED' : 'DEFERRED';
          rec.decisionAt = new Date().toISOString();
          rec.decisionBy = userId;
          rec.note = note;
          touched = true;
        }
        out.push(JSON.stringify(rec));
      }
      if (touched) {
        writeFileSync(path, out.join('\n') + '\n', 'utf8');
        return { ok: true, id, decision };
      }
    }
    return { ok: false, reason: 'NOT_FOUND' };
  }

  listFiles() {
    if (!existsSync(this.baseDir)) return [];
    return readdirSync(this.baseDir).filter((n) => n.endsWith('.jsonl'));
  }

  async list({ kind, status } = {}) {
    const out = [];
    for (const file of this.listFiles()) {
      const path = resolve(this.baseDir, file);
      const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        const rec = JSON.parse(line);
        if (kind && rec.kind !== kind) continue;
        if (status && rec.status !== status) continue;
        out.push(rec);
      }
    }
    return out;
  }

  async expire() {
    const now = Date.now();
    let count = 0;
    for (const file of this.listFiles()) {
      const path = resolve(this.baseDir, file);
      const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
      const out = [];
      let touched = false;
      for (const line of lines) {
        const rec = JSON.parse(line);
        if (rec.status === 'PENDING' && new Date(rec.expiresAt).getTime() < now) {
          rec.status = 'EXPIRED';
          touched = true;
          count += 1;
        }
        out.push(JSON.stringify(rec));
      }
      if (touched) {
        writeFileSync(path, out.join('\n') + '\n', 'utf8');
      }
    }
    return count;
  }
}
