import { readFileSync } from 'fs'
import { join } from 'path'

describe('useGiftSystem source validation', () => {
  const source = readFileSync(join(__dirname, '../useGiftSystem.ts'), 'utf-8')

  it('does not reference removed broadcast_chat_disabled fields', () => {
    expect(source).not.toContain('broadcast_chat_disabled')
    expect(source).not.toContain('broadcast_chat_disabled_until')
    expect(source).not.toContain('broadcast_chat_disabled_stream_id')
  })

  it('does not call isBroadcastChatLockActive', () => {
    expect(source).not.toContain('isBroadcastChatLockActive')
  })

  it('preserves moderation chat block check', () => {
    expect(source).toContain('is_user_chat_blocked')
  })
})
