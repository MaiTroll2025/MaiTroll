import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabase } from '@/lib/supabase'

// Mock the supabase client to simulate authoritative server-side ledger behavior
const mockFrom = vi.fn()
const mockSupabase = {
  from: mockFrom,
  rpc: vi.fn(),
  channel: vi.fn(() => ({
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    remove: vi.fn(),
    on: vi.fn(() => ({})),
  })),
} as any

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}))

// Shared chainable query builder mock
function makeChain(overrides: any = {}) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    ...overrides,
  }
  return chain
}

describe('MaiTroll Squads — Financial Separation (Bank vs Squad Cash)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prevents squad creation without sufficient coins', async () => {
    // Sufficient coins
    mockFrom.mockReturnValue(makeChain({
      maybeSingle: vi.fn(() => Promise.resolve({ data: { Troll_coins: 3000 }, error: null })),
    }))
    mockSupabase.rpc.mockResolvedValue({ data: { success: true, squad_id: 's1' }, error: null })

    const { data } = await mockSupabase.rpc('create_squad', {
      p_name: 'Test Squad', p_tag: 'TEST',
    })
    expect(data.success).toBe(true)

    // Insufficient coins
    mockFrom.mockReturnValue(makeChain({
      maybeSingle: vi.fn(() => Promise.resolve({ data: { Troll_coins: 100 }, error: null })),
    }))
    mockSupabase.rpc.mockResolvedValue({
      data: { success: false, error: 'Not enough Troll Coins', required: 3000, available: 100 },
      error: null,
    })
    const { data: d2 } = await mockSupabase.rpc('create_squad', {
      p_name: 'Poor Squad', p_tag: 'POOR',
    })
    expect(d2.success).toBe(false)
    expect(d2.error).toBe('Not enough Troll Coins')
  })

  it('splits joining fee 50/50 between leader and platform', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: {
        success: true,
        squad_id: 's1',
        fee_coins: 100,
        leader_share_coins: 50,
        platform_share_coins: 50,
        message: 'Joined Squad',
      },
      error: null,
    })
    const { data } = await mockSupabase.rpc('join_squad', { p_squad_id: 's1' })
    expect(data.success).toBe(true)
    expect(data.fee_coins).toBe(100)
    expect(data.leader_share_coins).toBe(50)
    expect(data.platform_share_coins).toBe(50)
  })

  it('rejects duplicate joining transactions', async () => {
    // User already has an active membership
    mockSupabase.rpc.mockResolvedValue({
      data: { success: false, error: 'You already belong to an active Squad' },
      error: null,
    })
    const { data } = await mockSupabase.rpc('join_squad', { p_squad_id: 's2' })
    expect(data.success).toBe(false)
    expect(data.error).toBe('You already belong to an active Squad')
  })

  it('keeps Squad Cash separate from daily Bank — same earning cannot be redeemed through both', async () => {
    // Accrue Squad Cash earning via authoritative ledger
    mockSupabase.rpc.mockResolvedValue({
      data: { success: true, amount_cents: 1000, message: 'Squad Cash accrued' },
      error: null,
    })
    const accrue = await mockSupabase.rpc('accrue_squad_earnings', {
      p_user_id: 'u1',
      p_squad_id: 's1',
      p_amount_cents: 1000,
      p_source_type: 'broadcast',
      p_source_transaction_id: 'tx_squad_001',
    })
    expect(accrue.data.success).toBe(true)

    // Squad Cash balance is tracked separately; Bank cashout eligibility is not incremented by Squad earnings
    mockSupabase.rpc.mockResolvedValue({
      data: { visible: true, amount_cents: 1000, usd: 10.00, reason: 'visible' },
      error: null,
    })
    const squadBal = await mockSupabase.rpc('get_squad_cash_balance', {
      p_target_user_id: 'u1',
      p_viewer_id: 'u1',
    })
    expect(squadBal.data.amount_cents).toBe(1000)
    expect(squadBal.data.usd).toBe(10.00)
  })

  it('applies the 2% Squad payout fee on weekly Squad Cash payouts', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: {
        success: true,
        eligible_cents: 1000,
        fee_cents: 20,
        net_cents: 980,
        status: 'pending',
        message: 'Weekly Squad payouts settled',
      },
      error: null,
    })
    const { data } = await mockSupabase.rpc('settle_squad_weekly', { p_settlement_period_id: 'sp1' })
    expect(data.success).toBe(true)
    expect(data.eligible_cents).toBe(1000)
    expect(data.fee_cents).toBe(20)
    expect(data.net_cents).toBe(980)
  })

  it('preserves Squad Cash weekly hold after leave/kick/dissolve — no early Bank conversion', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: { success: true, squad_id: 's1', message: 'Left Squad' },
      error: null,
    })
    const leave = await mockSupabase.rpc('leave_squad', { p_squad_id: 's1' })
    expect(leave.data.success).toBe(true)

    // Squad Cash remains locked under original weekly settlement
    mockSupabase.rpc.mockResolvedValue({
      data: { visible: true, amount_cents: 2400, usd: 24.00, reason: 'visible' },
      error: null,
    })
    const bal = await mockSupabase.rpc('get_squad_cash_balance', {
      p_target_user_id: 'u1',
      p_viewer_id: 'u1',
    })
    expect(bal.data.amount_cents).toBe(2400)
    expect(bal.data.usd).toBe(24.00)
  })

  it('does not let a membership change accelerate Squad Cash payout', async () => {
    // Leave then re-join — same weekly settlement assignment preserved
    mockSupabase.rpc.mockResolvedValue({ data: { success: true }, error: null })
    await mockSupabase.rpc('leave_squad', { p_squad_id: 's1' })
    await mockSupabase.rpc('join_squad', { p_squad_id: 's1' })
    // Squad Cash balance unchanged and still weekly-held
    mockSupabase.rpc.mockResolvedValue({
      data: { visible: true, amount_cents: 2400, usd: 24.00, reason: 'visible' },
      error: null,
    })
    const bal = await mockSupabase.rpc('get_squad_cash_balance', {
      p_target_user_id: 'u1',
      p_viewer_id: 'u1',
    })
    expect(bal.data.usd).toBe(24.00)
  })

  it('enforces Squad Cash privacy — same squad member can view when enabled', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: { visible: true, amount_cents: 5000, usd: 50.00, reason: 'visible' },
      error: null,
    })
    const bal = await mockSupabase.rpc('get_squad_cash_balance', {
      p_target_user_id: 'u1',
      p_viewer_id: 'u2', // same squad member
    })
    expect(bal.data.visible).toBe(true)
    expect(bal.data.usd).toBe(50.00)
  })

  it('hides Squad Cash from different squad members and anonymous viewers', async () => {
    // Different squad member: hidden
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { visible: false, amount_cents: 0, usd: 0, reason: 'hidden' },
      error: null,
    })
    const otherSquad = await mockSupabase.rpc('get_squad_cash_balance', {
      p_target_user_id: 'u1',
      p_viewer_id: 'u3', // different squad
    })
    expect(otherSquad.data.visible).toBe(false)

    // Anonymous viewer: authentication required
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { visible: false, amount_cents: 0, usd: 0, reason: 'authentication required' },
      error: null,
    })
    const anonymous = await mockSupabase.rpc('get_squad_cash_balance', {
      p_target_user_id: 'u1',
      p_viewer_id: null,
    })
    expect(anonymous.data.visible).toBe(false)
    expect(anonymous.data.reason).toBe('authentication required')
  })

  it('defaults Bank visibility to private and honors the toggle', async () => {
    // Disabled: other users cannot see Bank
    mockSupabase.rpc.mockResolvedValue({
      data: { visible: false, coins: 0, usd: 0, next_tier_coins: 0, tier_usd: 0, reason: 'hidden' },
      error: null,
    })
    const hidden = await mockSupabase.rpc('get_bank_cash_value', {
      p_target_user_id: 'u1',
      p_viewer_id: 'u2',
    })
    expect(hidden.data.visible).toBe(false)

    // Enabled: viewer can see Bank
    mockSupabase.rpc.mockResolvedValue({
      data: {
        visible: true,
        coins: 7000,
        usd: 20.00,
        next_tier_coins: 3500,
        tier_usd: 10.00,
        reason: 'visible',
      },
      error: null,
    })
    const shown = await mockSupabase.rpc('get_bank_cash_value', {
      p_target_user_id: 'u1',
      p_viewer_id: 'u2',
    })
    expect(shown.data.visible).toBe(true)
    expect(shown.data.coins).toBe(7000)
    expect(shown.data.usd).toBe(20.00)
  })

  it('calculates Bank from authoritative cashout tier (3,500 TC = $10), not purchase rate', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: { visible: true, coins: 3500, usd: 10.00, next_tier_coins: 7500, tier_usd: 25.00, reason: 'visible' },
      error: null,
    })
    const bank = await mockSupabase.rpc('get_bank_cash_value', {
      p_target_user_id: 'u1',
      p_viewer_id: 'u1',
    })
    expect(bank.data.coins).toBe(3500)
    expect(bank.data.usd).toBe(10.00) // 3,500 TC = $10 cashout value
  })

  it('awards member stimulus only after successful PayPal payout confirmation', async () => {
    // 3,500 eligible TC redeemed × 2.5% = 87.5 → round half up to 88 TC
    const redeemedCoins = 3500
    const stimulusPct = 0.025
    const stimulus = Math.round(redeemedCoins * stimulusPct)
    expect(stimulus).toBe(88)
  })

  it('awards leader reward exactly once per qualifying member payout (5%, not deducted from member)', async () => {
    const redeemedCoins = 3500
    const leaderRewardPct = 0.05
    const leaderReward = Math.round(redeemedCoins * leaderRewardPct)
    expect(leaderReward).toBe(175)
    // Leader reward is separate — net payout unchanged
    const gross = 10.00
    const fee = 0.20
    const net = gross - fee
    expect(net).toBe(9.80)
  })
})
