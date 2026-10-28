import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSingOffActions } from '@/features/mai-sing-off/hooks/useSingOffActions'
import { mockAuthStore, mockSupabase } from '@/test/setup'

describe('useSingOffActions null-user guard (regression: user?.id)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockAuthStore.user = null
    mockSupabase.from.mockReturnValue(mockSupabase)
    mockSupabase.select.mockReturnValue(mockSupabase)
    mockSupabase.eq.mockReturnValue(mockSupabase)
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null })
  })

  it('loadSession does not throw when user is null', async () => {
    const { result } = renderHook(() => useSingOffActions())
    await act(async () => {
      await result.current.loadSession('session-123')
    })
    expect(result.error).toBeUndefined()
  })

  it('startShow returns null when user is null (no crash on user.id)', async () => {
    const { result } = renderHook(() => useSingOffActions())
    const id = await result.current.startShow({})
    expect(id).toBeNull()
  })

  it('startLiveShow returns early when user is null', async () => {
    const { result } = renderHook(() => useSingOffActions())
    await act(async () => {
      await result.current.startLiveShow('sid-1')
    })
    expect(result.error).toBeUndefined()
  })

  it('endLiveShow returns early when user is null', async () => {
    const { result } = renderHook(() => useSingOffActions())
    await act(async () => {
      await result.current.endLiveShow('sid-1')
    })
    expect(result.error).toBeUndefined()
  })

  it('requestQueue returns early when user is null', async () => {
    const { result } = renderHook(() => useSingOffActions())
    await act(async () => {
      await result.current.requestQueue(null)
    })
    expect(result.error).toBeUndefined()
  })

  it('claimSeat returns not-logged-in when user is null', async () => {
    const { result } = renderHook(() => useSingOffActions())
    const res = await result.current.claimSeat('challenger_a')
    expect(res).toEqual({ success: false, error: 'not logged in' })
  })

  it('joinAsAudience returns early when user is null', async () => {
    const { result } = renderHook(() => useSingOffActions())
    await act(async () => {
      await result.current.joinAsAudience('sid-1')
    })
    expect(result.error).toBeUndefined()
  })
})
