import { act, renderHook, waitFor } from '@testing-library/react'

const rpcMock = jest.fn()
const toastErrorMock = jest.fn()
const toastSuccessMock = jest.fn()

jest.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}))

const subscribeMock = jest.fn().mockImplementation((callback: ((status: string) => void) | undefined) => {
  if (typeof callback === 'function') {
    callback('SUBSCRIBED')
  }
  return { unsubscribe: jest.fn() }
})

const channelMock: any = {}
channelMock.on = jest.fn().mockReturnValue(channelMock)
channelMock.subscribe = subscribeMock
channelMock.send = jest.fn().mockResolvedValue(undefined)

jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: any[]) => rpcMock(...args),
    from: jest.fn(),
    channel: jest.fn(() => channelMock),
    removeChannel: jest.fn(),
  },
}))

jest.mock('../../lib/store', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user-1',
      email: 'viewer@example.com',
      username: 'viewer',
    },
  }),
}))

import { useStreamSeats } from '../useStreamSeats'

describe('useStreamSeats', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    rpcMock.mockReset()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
    jest.spyOn(window, 'setInterval').mockImplementation(() => 0 as unknown as number)
    jest.spyOn(window, 'clearInterval').mockImplementation(() => undefined)

    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === 'get_stream_seats') {
        return Promise.resolve({ data: [], error: null })
      }

      if (fnName === 'join_seat_atomic') {
        return Promise.resolve({ data: { success: true }, error: null })
      }

      if (fnName === 'leave_seat_atomic') {
        return Promise.resolve({ data: { success: true }, error: null })
      }

      return Promise.resolve({ data: null, error: null })
    })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('clears the seat after leaving immediately after joining', async () => {
    const getSeatsSequence = [
      [],
      [
        {
          id: 'seat-real-1',
          seat_index: 1,
          user_id: 'user-1',
          guest_id: null,
          status: 'reserved',
          joined_at: new Date().toISOString(),
          left_at: null,
          livekit_participant_identity: null,
          seat_price_paid: 10,
          updated_at: new Date().toISOString(),
        },
      ],
      [],
    ]

    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === 'get_stream_seats') {
        const next = getSeatsSequence.shift()
        return Promise.resolve({ data: next ?? [], error: null })
      }

      if (fnName === 'join_seat_atomic') {
        return Promise.resolve({ data: { success: true }, error: null })
      }

      if (fnName === 'leave_seat_atomic') {
        return Promise.resolve({ data: { success: true }, error: null })
      }

      return Promise.resolve({ data: null, error: null })
    })

    const { result } = renderHook(() => useStreamSeats('stream-1', 'user-1'))

    await waitFor(() => {
      expect(result.current.seats).toEqual({})
    })

    await act(async () => {
      await result.current.joinSeat(1, 10)
    })

    await waitFor(() => {
      expect(result.current.seats[1]).toBeDefined()
    })

    await act(async () => {
      await result.current.leaveSeat()
    })

    console.log('RPC calls after leave:', rpcMock.mock.calls)
    console.log('seats immediately after leave act:', result.current.seats)

    await waitFor(() => {
      expect(result.current.seats).toEqual({})
    })
    expect(result.current.mySeat).toBeNull()
    expect(rpcMock).toHaveBeenCalledWith('leave_seat_atomic', { p_session_id: 'seat-real-1' })
  })

  it('builds seat profile from flat seat fields returned by RPC', async () => {
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === 'get_stream_seats') {
        return Promise.resolve({
          data: [
            {
              id: 'seat-real-1',
              seat_index: 1,
              user_id: 'user-1',
              guest_id: null,
              status: 'active',
              joined_at: new Date().toISOString(),
              username: 'viewer',
              avatar_url: 'https://example.com/avatar.png',
              role: 'user',
              troll_coins: 100,
            },
          ],
          error: null,
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const { result } = renderHook(() => useStreamSeats('stream-1', 'user-1'))

    await act(async () => {
      await Promise.resolve()
    })

    const seat = result.current.seats[1]
    expect(seat).toBeDefined()
    expect(seat.user_profile).toEqual(expect.objectContaining({
      display_name: 'viewer',
      username: 'viewer',
      avatar_url: 'https://example.com/avatar.png',
      role: 'user',
    }))
  })

  it('normalizes legacy seat status values like live to active', async () => {
    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === 'get_stream_seats') {
        return Promise.resolve({
          data: [
            {
              id: 'seat-real-1',
              seat_index: 1,
              user_id: 'user-1',
              guest_id: null,
              status: 'live',
              joined_at: new Date().toISOString(),
              username: 'viewer',
              avatar_url: 'https://example.com/avatar.png',
              role: 'user',
            },
          ],
          error: null,
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const { result } = renderHook(() => useStreamSeats('stream-1', 'user-1'))

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.seats[1]?.status).toBe('active')
  })

  it('falls back to leave_stream_seat when leave_seat_atomic is unavailable', async () => {
    const getSeatsSequence = [
      [
        {
          id: 'seat-real-1',
          seat_index: 1,
          user_id: 'user-1',
          guest_id: null,
          status: 'active',
          joined_at: new Date().toISOString(),
          username: 'viewer',
          avatar_url: 'https://example.com/avatar.png',
        },
      ],
      [],
    ]

    rpcMock.mockImplementation((fnName: string) => {
      if (fnName === 'get_stream_seats') {
        const next = getSeatsSequence.shift()
        return Promise.resolve({ data: next ?? [], error: null })
      }
      if (fnName === 'leave_seat_atomic') {
        return Promise.resolve({ data: null, error: { message: 'function public.leave_seat_atomic does not exist' } })
      }
      if (fnName === 'leave_stream_seat') {
        return Promise.resolve({ data: null, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const { result } = renderHook(() => useStreamSeats('stream-1', 'user-1'))

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      await result.current.leaveSeat()
    })

    expect(rpcMock).toHaveBeenCalledWith('leave_seat_atomic', { p_session_id: 'seat-real-1' })
    expect(rpcMock).toHaveBeenCalledWith('leave_stream_seat', { p_session_id: 'seat-real-1' })
    expect(result.current.mySeat).toBeNull()
  })
})
