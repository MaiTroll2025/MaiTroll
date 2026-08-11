import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';

interface RaidPanelProps {
  targetUserId: string;
  targetHouseId: string;
  isOpen: boolean;
  onClose: () => void;
  onRaidComplete?: () => void;
}

export default function RaidPanel({ targetUserId, targetHouseId, isOpen, onClose, onRaidComplete }: RaidPanelProps) {
  const { user } = useAuthStore();
  const [raiding, setRaiding] = useState(false);

  const handleRaid = async () => {
    if (!user?.id) {
      toast.error('You must be signed in to raid');
      return;
    }

    setRaiding(true);
    try {
      const { data, error } = await supabase.rpc('raid_property', {
        p_attacker_id: user.id,
        p_target_user_id: targetUserId,
        p_target_house_id: targetHouseId,
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        toast.success(result.message || 'Raid successful!');
        onRaidComplete?.();
        onClose();
      } else {
        toast.error(result?.message || 'Raid failed');
      }
    } catch (err: any) {
      console.error('Raid error:', err);
      toast.error(err?.message || 'Raid failed');
    } finally {
      setRaiding(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border-slate-700 bg-slate-900 text-white">
        <DialogHeader>
          <DialogTitle>Raid Property</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Raiding will cost <span className="font-bold text-yellow-400">100 Troll Coins</span> and deal damage to the property.
          </p>
          <p className="text-xs text-slate-400">
            If the target has active insurance, they only pay their deductible. Otherwise, they pay the full repair cost.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={handleRaid}
              disabled={raiding}
              className="bg-gradient-to-r from-red-500 to-orange-500"
            >
              {raiding ? 'Raiding...' : 'Raid (100 TC)'}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
