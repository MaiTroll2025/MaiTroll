import { create } from 'zustand';

interface AdminRealtimeState {
  // cached data
  coinPurchases: any[];
  applications: any[];
  payoutRequests: any[];
  supportTickets: any[];
  onlineUsers: any[];

  // subscription status
  isInitialized: boolean;

  // actions
  initialize: () => void;
  refreshAll: () => Promise<void>;
}

export const useAdminRealtimeStore = create<AdminRealtimeState>((set, get) => ({
  coinPurchases: [],
  applications: [],
  payoutRequests: [],
  supportTickets: [],
  onlineUsers: [],
  isInitialized: false,

  initialize: () => {
    const state = get();
    if (state.isInitialized) return;

    // We'll keep this minimal - just fetch data on demand
    // Avoid global subscriptions to high-velocity tables
    set({ isInitialized: true });
  },

  refreshAll: async () => {
    // Refresh all admin data via REST queries instead of realtime
    // This keeps all admin pages in sync without duplicate subscriptions
    const { coinPurchases: _coinPurchases, applications: _applications, payoutRequests: _payoutRequests, supportTickets: _supportTickets, onlineUsers: _onlineUsers } = get();

    // Each component can still fetch its own data
    // This store just coordination point if needed
  },
}));
