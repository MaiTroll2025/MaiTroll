import {
  calculateSupabaseMonthlyEstimate,
  formatCost,
  SUPABASE_PRICING,
  type SupabaseUsageSnapshot,
} from '../supabasePricing'

describe('supabase pricing utilities', () => {
  it('computes a monthly estimate from usage inputs', () => {
    const snapshot: SupabaseUsageSnapshot = {
      projectKey: 'MaiTroll-prod',
      billingPeriodStart: '2026-07-01',
      billingPeriodEnd: '2026-07-31',
      databaseGbHours: 120,
      databaseCpuHours: 420,
      storageGb: 80,
      storageEgressGb: 250,
      storageBucketGb: 40,
      authMonthlyActiveUsers: 6000,
      realtimeChannels: 14,
      realtimeMessages: 5400,
      telemetryEvents: 42000,
      confidence: 'high',
      source: 'estimation',
    }

    const estimate = calculateSupabaseMonthlyEstimate(snapshot)

    expect(estimate.totalMonthlyCost).toBeGreaterThan(0)
    expect(estimate.items.database).toBeGreaterThan(0)
    expect(estimate.items.storage).toBeGreaterThan(0)
    expect(estimate.items.auth).toBeGreaterThan(0)
    expect(estimate.summary).toContain('Estimated monthly cost')
    expect(estimate.totalMonthlyCost).toBeCloseTo(estimate.items.database + estimate.items.storage + estimate.items.auth + estimate.items.realtime + estimate.items.cdn + estimate.items.telemetry + estimate.items.edge, 6)
  })

  it('formats currency with the configured symbol', () => {
    expect(formatCost(12.345)).toContain('$')
    expect(formatCost(SUPABASE_PRICING.database.computeRatePerHour * 2)).toContain('$')
  })
})
