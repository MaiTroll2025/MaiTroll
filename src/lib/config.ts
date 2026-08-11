export const EDGE_URL = import.meta.env.VITE_EDGE_FUNCTIONS_URL || 'https://gejtbllazzighxwxudyu.supabase.co/functions/v1'

export const AGORA_REGION = import.meta.env.VITE_AGORA_REGION || 'na'

export const API_ENDPOINTS = {
  auth: {
    fixAdminRole: `${EDGE_URL}/auth/fix-admin-role`,
  },
  payments: {
    status: `${EDGE_URL}/payments-status`,
  },
  livekit: {
    token: `${EDGE_URL}/livekit-token`,
  },
  admin: {
    trollDrop: `${EDGE_URL}/admin/troll-drop`,
  },
}
