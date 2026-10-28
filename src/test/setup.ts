import { vi } from 'vitest'
import { SupabaseClient } from '@supabase/supabase-js'

// Mock supabase client for tests
export const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  is: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase),
  gte: vi.fn(() => mockSupabase),
  lte: vi.fn(() => mockSupabase),
  maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
  single: vi.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  channel: vi.fn(() => ({
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    remove: vi.fn(),
    on: vi.fn(),
  })),
  removeChannel: vi.fn(),
} as unknown as SupabaseClient

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
  UserRole: { ADMIN: 'admin', MODERATOR: 'moderator', STAFF: 'staff' },
}))

// Mock auth store
export const mockAuthStore = {
  user: null,
  profile: null,
  session: null,
  isLoading: false,
  setAuth: vi.fn(),
  setProfile: vi.fn(),
  logout: vi.fn(() => Promise.resolve()),
}

vi.mock('@/lib/store', () => ({
  useAuthStore: vi.fn((selector: any) => {
    if (typeof selector === 'function') {
      return selector(mockAuthStore)
    }
    return mockAuthStore
  }),
}))
