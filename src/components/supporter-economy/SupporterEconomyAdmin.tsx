import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Settings, TrendingUp, Gift, Newspaper, Crown, DollarSign, AlertTriangle } from 'lucide-react';
import type { SupporterEconomyConfig } from '@/types/supporterEconomy';

export function SupporterEconomyAdmin() {
  const queryClient = useQueryClient();
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { data: configs, isLoading } = useQuery<SupporterEconomyConfig[]>({
    queryKey: ['supporter-economy-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supporter_economy_config')
        .select('*')
        .order('config_key');

      if (error) throw error;
      return data;
    },
  });

  const updateConfig = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from('supporter_economy_config')
        .update({ config_value: value, updated_at: new Date().toISOString() })
        .eq('config_key', key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supporter-economy-config'] });
      setEditingConfig(null);
    },
  });

  const processRewards = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('process-friday-rewards', {
        body: { force: true },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashback-periods'] });
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-[#0A0814] border-white/10">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-white/10 rounded w-1/2" />
            <div className="h-8 bg-white/10 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#0A0814] border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
          <Shield className="h-4 w-4 text-cyan-400" />
          Supporter Economy Admin
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="config" className="w-full">
          <TabsList className="bg-white/5 border-white/10">
            <TabsTrigger value="config" className="data-[state=active]:bg-cyan-500/20">
              Config
            </TabsTrigger>
            <TabsTrigger value="rewards" className="data-[state=active]:bg-cyan-500/20">
              Rewards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-2">
            {configs?.map((config) => (
              <div
                key={config.config_key}
                className="flex items-center justify-between p-2 rounded-lg bg-white/5"
              >
                <div>
                  <div className="text-xs font-bold text-white">
                    {config.config_key}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {config.description} ({config.config_type})
                  </div>
                </div>
                {editingConfig === config.config_key ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-32 bg-white/5 border-white/10 text-white text-xs"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        updateConfig.mutate({
                          key: config.config_key,
                          value: editValue,
                        });
                      }}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingConfig(null);
                        setEditValue('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingConfig(config.config_key);
                      setEditValue(config.config_value);
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="rewards" className="space-y-2">
            <div className="p-3 rounded-lg bg-white/5 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-400">
                  Force Process Friday Rewards
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-2">
                This will immediately process and distribute weekly cashback rewards
                to all eligible users for the current week.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                onClick={() => processRewards.mutate()}
                disabled={processRewards.isPending}
              >
                {processRewards.isPending ? 'Processing...' : 'Process Now'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}