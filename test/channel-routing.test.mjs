import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveChannelId } from '../extensions/discord-tools-shared.mjs';

test('explicit channel categories resolve to their own target', () => {
  const cfg = {
    channels: {
      entry: 'entry-id',
      opportunity: 'opportunity-id',
      discover: 'signal-id',
      usage: 'usage-id',
      trend: 'trend-id',
    },
  };

  assert.equal(resolveChannelId({ category: 'opportunity' }, cfg), 'opportunity-id');
  assert.equal(resolveChannelId({ category: 'discover' }, cfg), 'opportunity-id');
  assert.equal(resolveChannelId({ category: 'usage' }, cfg), 'usage-id');
  assert.equal(resolveChannelId({}, cfg), 'entry-id');
  assert.equal(resolveChannelId({ channel_id: 'direct-id', category: 'unknown' }, cfg), 'direct-id');
});

test('unknown explicit categories never silently fall back to the entry channel', () => {
  const cfg = { channels: { entry: 'entry-id' } };
  assert.equal(resolveChannelId({ category: 'not-configured' }, cfg), null);
});
