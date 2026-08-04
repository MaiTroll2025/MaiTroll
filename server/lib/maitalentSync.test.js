const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail, buildMaiTalentPayload, buildMaiTalentLinkPayload, buildSourceEventId, resolveMaiTalentConfig, normalizeMaiTalentLinkResponse } = require('./maitalentSync');

test('normalizes email addresses for MaiTalent linking', () => {
  assert.equal(normalizeEmail('  User@Example.COM  '), 'user@example.com');
  assert.equal(normalizeEmail(''), '');
});

test('builds the expected payload for verified activity sync', () => {
  const payload = buildMaiTalentPayload({
    externalUserId: 'user-123',
    normalizedEmail: '  User@Example.COM  ',
    sourceEventId: 'Mai Troll:broadcast:abc123',
    activityType: 'broadcast',
    tokensAwarded: 25,
    metadata: { streamId: 'abc123', source: 'verified_stream_end' },
  });

  assert.deepEqual(payload, {
    action: 'sync',
    external_platform: 'troll-city',
    external_user_id: 'user-123',
    source_event_id: 'Mai Troll:broadcast:abc123',
    activity_type: 'broadcast',
    tokens_awarded: 25,
    normalized_email: 'user@example.com',
    metadata: { streamId: 'abc123', source: 'verified_stream_end' },
  });
});

test('builds deterministic source event IDs for broadcast activity', () => {
  assert.equal(
    buildSourceEventId({ scope: 'broadcast-start', streamId: 'stream-123', userId: 'user-456' }),
    'Mai Troll:broadcast-start:stream-123:user-456'
  );
  assert.equal(
    buildSourceEventId({ scope: 'broadcast-view', streamId: 'stream-123', userId: 'user-456' }),
    'Mai Troll:broadcast-view:stream-123:user-456'
  );
});

test('builds the expected payload for MaiTalent link requests', () => {
  const payload = buildMaiTalentLinkPayload({
    externalUserId: 'user-123',
    normalizedEmail: '  User@Example.COM  ',
    sourceEventId: 'Mai Troll:link:user-123',
    maitalentUserId: 'mai-user-456',
    metadata: { source: 'profile_page' },
  });

  assert.deepEqual(payload, {
    action: 'link',
    external_platform: 'troll-city',
    external_user_id: 'user-123',
    normalized_email: 'user@example.com',
    source_event_id: 'Mai Troll:link:user-123',
    maitalent_user_id: 'mai-user-456',
    metadata: { source: 'profile_page' },
  });
});

test('resolves the MaiTalent endpoint and secret from either link or sync env vars', () => {
  assert.deepEqual(resolveMaiTalentConfig({ MAITALENT_LINK_URL: 'https://link.example', MAITALENT_LINK_SECRET: 'link-secret' }), {
    url: 'https://link.example',
    secret: 'link-secret',
  });

  assert.deepEqual(resolveMaiTalentConfig({ MAITALENT_SYNC_URL: 'https://sync.example', MAITALENT_SYNC_SECRET: 'sync-secret' }), {
    url: 'https://sync.example',
    secret: 'sync-secret',
  });
});

test('treats successful MaiTalent link responses as success even when the payload is minimal', () => {
  assert.deepEqual(normalizeMaiTalentLinkResponse({ success: true, status: 'linked' }), {
    success: true,
    status: 'linked',
    detail: { success: true, status: 'linked' },
    message: '',
  });

  assert.deepEqual(normalizeMaiTalentLinkResponse({ linked: true }), {
    success: true,
    status: 'linked',
    detail: { linked: true },
    message: '',
  });
});
