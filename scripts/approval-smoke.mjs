import('../src/runtime/approval.mjs').then(async ({ Approval }) => {
  const a = new Approval();
  const r1 = await a.check('quote-send', { producer: 'quote', objectId: 'QTE-2026-0001', summary: 'QTE for client-alpha' });
  console.log('check quote-send =>', r1.status, r1.approval?.id, r1.approval?.risk);
  const r2 = await a.check('prod-deploy', { producer: 'delivery', objectId: 'PRJ-2026-0001', summary: 'prod deploy' });
  console.log('check prod-deploy =>', r2.status, r2.approval?.id, r2.approval?.risk, 'expires', r2.approval?.expiresAt);
  const r3 = await a.check('payment-remind', { producer: 'finance', objectId: 'INV-2026-0001', summary: 'remind' });
  console.log('check payment-remind =>', r3.status, r3.approval?.id, r3.approval?.risk, 'channel', r3.approval?.channel);
  const r4 = await a.check('unknown-kind', {});
  console.log('check unknown =>', r4);
  const list = await a.list({ status: 'PENDING' });
  console.log('pending list =>', list.length, 'items');
  const grant = await a.grant(r1.approval.id, 'approve', 'U-1', 'looks good');
  console.log('grant =>', grant);
  const list2 = await a.list({});
  console.log('total =>', list2.length);
});
