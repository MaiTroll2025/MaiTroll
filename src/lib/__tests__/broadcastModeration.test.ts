import { isBroadcastChatLockActive, getBroadcastChatLockRemainingMs } from '../broadcastModeration'

describe('broadcastModeration', () => {
  describe('isBroadcastChatLockActive', () => {
    it('returns false when disabled is falsy', () => {
      expect(isBroadcastChatLockActive({ disabled: false, streamId: 's1' })).toBe(false)
      expect(isBroadcastChatLockActive({ disabled: undefined, streamId: 's1' })).toBe(false)
      expect(isBroadcastChatLockActive({ disabled: null, streamId: 's1' })).toBe(false)
    })

    it('returns false when streamId does not match lockedStreamId', () => {
      expect(isBroadcastChatLockActive({
        disabled: true,
        streamId: 's1',
        lockedStreamId: 's2',
      })).toBe(false)
    })

    it('returns true when disabled is true with no until or matching stream', () => {
      expect(isBroadcastChatLockActive({
        disabled: true,
        streamId: 's1',
        lockedStreamId: 's1',
      })).toBe(true)
    })

    it('returns false when until is in the past', () => {
      const past = new Date(Date.now() - 1000).toISOString()
      expect(isBroadcastChatLockActive({
        disabled: true,
        until: past,
        streamId: 's1',
        lockedStreamId: 's1',
      })).toBe(false)
    })

    it('returns true when until is in the future', () => {
      const future = new Date(Date.now() + 1000).toISOString()
      expect(isBroadcastChatLockActive({
        disabled: true,
        until: future,
        streamId: 's1',
        lockedStreamId: 's1',
      })).toBe(true)
    })
  })

  describe('getBroadcastChatLockRemainingMs', () => {
    it('returns 0 when until is null', () => {
      expect(getBroadcastChatLockRemainingMs(null)).toBe(0)
    })

    it('returns 0 when until is undefined', () => {
      expect(getBroadcastChatLockRemainingMs(undefined)).toBe(0)
    })

    it('returns 0 when until is in the past', () => {
      const past = new Date(Date.now() - 1000).toISOString()
      expect(getBroadcastChatLockRemainingMs(past)).toBe(0)
    })

    it('returns positive value when until is in the future', () => {
      const future = new Date(Date.now() + 5000).toISOString()
      const remaining = getBroadcastChatLockRemainingMs(future)
      expect(remaining).toBeGreaterThan(0)
      expect(remaining).toBeLessThanOrEqual(5000)
    })
  })
})
