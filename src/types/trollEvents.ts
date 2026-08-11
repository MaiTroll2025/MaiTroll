export interface TrollEvent {
  id: string;
  stream_id: string;
  event_type: 'red' | 'green';
  coin_reward: number;
  started_at: string;
  expires_at: string;
  created_at: string;
  status?: 'active' | 'completed' | 'expired';
  sourceEventId: string;
  metadata?: any;
}

