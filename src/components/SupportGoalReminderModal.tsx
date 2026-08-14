import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Play, X } from 'lucide-react';

interface SupportGoalReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  broadcaster: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string;
    stream_id: string | null;
    current_balance: number;
    next_cashout_tier: number;
    coins_needed: number;
    cashout_label: string;
  };
}

const SupportGoalReminderModal: React.FC<SupportGoalReminderModalProps> = ({
  isOpen,
  onClose,
  broadcaster
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleWatchLive = async () => {
    if (broadcaster.stream_id) {
      navigate(`/live/${encodeURIComponent(broadcaster.username)}`);
    }
    onClose();
    
    // Mark as seen for 12 hours when user clicks Watch Live
    if (user?.id) {
      try {
        await supabase.from('support_goal_reminder_dismissals').insert({
          viewer_user_id: user.id,
          broadcaster_user_id: broadcaster.id,
          stream_id: broadcaster.stream_id,
          cashout_tier: broadcaster.next_cashout_tier
        });
      } catch (error) {
        console.error('Failed to save dismissal:', error);
      }
    }
  };

  const handleMaybeLater = async () => {
    onClose();
    
    // Mark as dismissed for 12 hours when user clicks Maybe Later
    if (user?.id) {
      try {
        await supabase.from('support_goal_reminder_dismissals').insert({
          viewer_user_id: user.id,
          broadcaster_user_id: broadcaster.id,
          stream_id: broadcaster.stream_id,
          cashout_tier: broadcaster.next_cashout_tier
        });
      } catch (error) {
        console.error('Failed to save dismissal:', error);
      }
    }
  };

  if (!isOpen) return null;

  const progressPercentage = Math.min(
    ((broadcaster.next_cashout_tier - broadcaster.coins_needed) / broadcaster.next_cashout_tier) * 100,
    100
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-xs px-4">
        <div className="bg-gradient-to-br from-[#0a0a0a] to-[#1a1a2e] border border-[rgba(0,255,255,0.3)] rounded-2xl shadow-2xl">
          <div className="p-6 space-y-4">
            <div className="flex items-center space-x-4">
              <img 
                src={broadcaster.avatar_url} 
                alt={`${broadcaster.display_name}'s avatar`} 
                className="w-16 h-16 rounded-full border-2 border-[rgba(0,255,255,0.5)]"
              />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[#00ffff]">{broadcaster.display_name}</h2>
                <p className="text-sm text-[#a0a0c0]">@${broadcaster.username}</p>
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-base text-[#e0e0ff]">
                Your friend <span className="text-[#00ffff]">{broadcaster.display_name}</span> is live and only 
                <span className="text-[#ff00ff] font-bold">{broadcaster.coins_needed}</span> Troll Coins away from cashing out.
              </p>
              <p className="text-xs text-[#8080a0]">
                Cashouts are subject to Mai Troll eligibility and payout rules.
              </p>
            </div>
            
            <div className="space-y-3">
              <div className="w-full bg-[rgba(0,0,0,0.5)] rounded-full h-2.5 overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r from-[#00ffff] to-[#ff00ff] transition-all duration-700 w-[${progressPercentage}%]`} 
                ></div>
              </div>
              <div className="flex justify-between text-xs text-[#a0a0c0]">
                <span>{broadcaster.next_cashout_tier - broadcaster.coins_needed} / {broadcaster.next_cashout_tier} Coins</span>
                <span>{broadcaster.cashout_label}</span>
              </div>
            </div>
            
            <div className="flex flex-col space-y-3 pt-2">
              <button 
                onClick={handleWatchLive}
                className="w-full bg-[#00ffff] text-[#0a0a0a] font-semibold py-3 px-4 rounded-lg hover:bg-[#00ffff]/90 transition-colors flex items-center justify-center gap-2"
              >
                <Play size={16} />
                Watch Live
              </button>
              
              <button 
                onClick={handleMaybeLater}
                className="w-full bg-[rgba(0,0,0,0.5)] text-[#e0e0ff] font-semibold py-3 px-4 rounded-lg border border-[rgba(0,255,255,0.3)] hover:bg-[rgba(0,0,0,0.7)] transition-colors flex items-center justify-center gap-2"
              >
                <X size={16} />
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportGoalReminderModal;