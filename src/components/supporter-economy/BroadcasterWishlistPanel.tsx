import React, { useState } from 'react';
import { useBroadcasterWishlist, useCreateWishlist, useAddWishlistItem, useBackWishlistItem } from '@/hooks/useBroadcasterWishlist';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Gift, Plus, CheckCircle2, TrendingUp, Clock, AlertCircle, Star } from 'lucide-react';
import type { BroadcasterWishlist, WishlistItem } from '@/types/supporterEconomy';

export function BroadcasterWishlistPanel() {
  const { profile } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const broadcasterId = profile?.id;
  const { data: wishlists, isLoading } = useBroadcasterWishlist(broadcasterId);
  const createWishlist = useCreateWishlist();
  const addItem = useAddWishlistItem();
  const backItem = useBackWishlistItem();

  const handleCreateWishlist = () => {
    if (!newTitle.trim() || !broadcasterId) return;
    createWishlist.mutate(
      {
        broadcaster_id: broadcasterId,
        title: newTitle.trim(),
        description: newDesc.trim(),
        target_amount: 100,
      },
      {
        onSuccess: () => {
          setNewTitle('');
          setNewDesc('');
          setShowCreate(false);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Card className="bg-[#0A0814] border-white/10">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-white/10 rounded w-1/2" />
            <div className="h-12 bg-white/10 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#0A0814] border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
          <Gift className="h-4 w-4 text-purple-400" />
          Broadcaster Wishlist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {wishlists && wishlists.length > 0 ? (
          wishlists.map((wl: BroadcasterWishlist) => (
            <div key={wl.id} className="p-3 rounded-lg bg-white/5 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-white">{wl.title}</h4>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    wl.status === 'completed'
                      ? 'bg-green-500/20 text-green-400'
                      : wl.status === 'cancelled'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-cyan-500/20 text-cyan-400'
                  }`}
                >
                  {wl.status}
                </span>
              </div>

              {wl.description && (
                <p className="text-xs text-slate-400 mb-2">{wl.description}</p>
              )}

              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min((wl.current_amount / wl.target_amount) * 100, 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] font-bold text-white">
                  {wl.current_amount}/{wl.target_amount}
                </span>
              </div>

              {wl.completed_at && (
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Completed on {new Date(wl.completed_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-slate-500 text-xs">
            No active wishlists
          </div>
        )}

        {showCreate ? (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
            <Input
              placeholder="Wishlist title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
            />
            <Textarea
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreateWishlist} className="flex-1">
                Create
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCreate(true)}
            className="w-full border-white/10 text-slate-400 hover:text-white"
          >
            <Plus className="h-3 w-3 mr-1" />
            New Wishlist
          </Button>
        )}
      </CardContent>
    </Card>
  );
}