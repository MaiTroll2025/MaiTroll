import { readFileSync } from 'fs'
import { join } from 'path'

describe('send-message edge function', () => {
  const functionPath = join(__dirname, '..', 'index.ts')
  let source: string

  beforeAll(() => {
    source = readFileSync(functionPath, 'utf-8')
  })

  it('does not reference removed broadcast_chat_disabled fields on user_profiles', () => {
    expect(source).not.toContain('broadcast_chat_disabled')
    expect(source).not.toContain('broadcast_chat_disabled_until')
    expect(source).not.toContain('broadcast_chat_disabled_stream_id')
  })

  it('does not contain isBroadcastChatLockActive helper', () => {
    expect(source).not.toContain('isBroadcastChatLockActive')
  })

  it('preserves chat_blocks moderation check', () => {
    expect(source).toContain('chat_blocks')
  })

  it('preserves broadcast_mod_actions disable_chat check', () => {
    expect(source).toContain('broadcast_mod_actions')
    expect(source).toContain('disable_chat')
  })

  it('preserves rate limiting logic', () => {
    expect(source).toContain('RATE_LIMITED')
  })

  it('preserves replay protection', () => {
    expect(source).toContain('REPLAY_ERROR')
  })

  it('preserves message insert before broadcast', () => {
    expect(source).toContain('stream_messages')
    expect(source).toContain('INSERT_FAILED')
  })

  it('preserves push notification invocation', () => {
    expect(source).toContain('push-notifications')
  })
})
