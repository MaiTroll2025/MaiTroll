import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { toast } from 'sonner';
import { Check, FileText, RefreshCw, X } from 'lucide-react';
import { format } from 'date-fns';

interface Proposal {
  id: string;
  title: string;
  description: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  created_by: string;
  created_at: string;
  creator?: {
    username: string;
    avatar_url: string;
  };
  review_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

interface ProposalManagementPanelProps {
  viewMode: 'admin' | 'secretary';
}

export default function ProposalManagementPanel({ viewMode: _viewMode }: ProposalManagementPanelProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeModule, setActiveModule] = useState('pending');

  const fetchProposals = async () => {
    setLoading(true);
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('president_proposals')
        .select(`
          *,
          creator:user_profiles!created_by(username, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProposals(data || []);
    } catch (err: any) {
      console.error('Error fetching proposals:', err);
      toast.error('Failed to load proposals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    const note = prompt(`Enter a review note for ${status.toUpperCase()}:`);
    if (note === null) return; // Cancelled

    try {
      const { error } = await supabase
        .from('president_proposals')
        .update({
          status,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString(),
          review_note: note
        })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Proposal ${status}`);
      fetchProposals();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update proposal');
    }
  };

  const counts = useMemo(() => ({
    pending: proposals.filter((p) => p.status === 'pending').length,
    approved: proposals.filter((p) => p.status === 'approved').length,
    rejected: proposals.filter((p) => p.status === 'rejected').length,
    all: proposals.length,
  }), [proposals]);

  const filteredProposals = proposals.filter((p) =>
    activeModule === 'all' ? true : p.status === activeModule
  );

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    approved: 'bg-green-500/20 text-green-400 border-green-500/50',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/50',
    expired: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
  };

  const modules = [
    {
      id: 'pending',
      label: 'Pending',
      icon: <FileText className="w-4 h-4" />,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30',
      count: counts.pending,
    },
    {
      id: 'approved',
      label: 'Approved',
      icon: <Check className="w-4 h-4" />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30',
      count: counts.approved,
    },
    {
      id: 'rejected',
      label: 'Rejected',
      icon: <X className="w-4 h-4" />,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/30',
      count: counts.rejected,
    },
    {
      id: 'all',
      label: 'All History',
      icon: <FileText className="w-4 h-4" />,
      color: 'text-slate-400',
      bgColor: 'bg-slate-500/20',
      borderColor: 'border-slate-500/30',
      count: counts.all,
    },
  ];

  const activeModuleConfig = modules.find((m) => m.id === activeModule) || modules[0];

  return (
    <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 border border-purple-500/30 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Presidential Proposals</h3>
            <p className="text-sm text-gray-400">Review and manage proposals from the President</p>
          </div>
        </div>
        <button
          onClick={fetchProposals}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[#2C2C2C] hover:bg-[#3C3C3C] rounded-lg font-semibold text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Module Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => setActiveModule(module.id)}
            className={`relative p-4 rounded-lg border transition-all duration-200 ${
              activeModule === module.id
                ? `${module.bgColor} ${module.borderColor} border-opacity-100`
                : 'bg-[#0A0814] border-[#2C2C2C] hover:border-[#3C3C3C]'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  activeModule === module.id ? module.bgColor : 'bg-[#2C2C2C]'
                }`}
              >
                <div className={activeModule === module.id ? module.color : 'text-gray-400'}>
                  {module.icon}
                </div>
              </div>
              <div className="text-left">
                <div
                  className={`text-sm font-medium ${
                    activeModule === module.id ? 'text-white' : 'text-gray-300'
                  }`}
                >
                  {module.label}
                </div>
                <div className="text-xs text-gray-400">{module.count}</div>
              </div>
            </div>
            {activeModule === module.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
            )}
          </button>
        ))}
      </div>

      {/* Active Module Content */}
      <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-white flex items-center gap-2">
            <span className={activeModuleConfig.color}>{activeModuleConfig.icon}</span>
            {activeModuleConfig.label} ({activeModuleConfig.count})
          </h4>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading proposals...
          </div>
        ) : filteredProposals.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No proposals found in this category
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {filteredProposals.map((proposal) => (
              <div key={proposal.id} className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">
                <div className="flex justify-between items-start mb-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 px-2 py-1 rounded text-xs font-bold border border-slate-700 text-slate-300 bg-slate-500/10 uppercase tracking-wider">
                      {proposal.type}
                    </span>
                    <h3 className="truncate font-bold text-white">{proposal.title}</h3>
                  </div>
                  <div className={`shrink-0 px-2 py-1 rounded text-xs font-bold border uppercase ${statusColors[proposal.status]}`}>
                    {proposal.status}
                  </div>
                </div>

                <p className="text-gray-400 mb-4 text-sm leading-relaxed">
                  {proposal.description}
                </p>

                <div className="flex items-center justify-between text-xs text-gray-500 border-t border-[#2C2C2C] pt-3">
                  <div className="flex items-center gap-2">
                    <span>Submitted by {proposal.creator?.username || 'Unknown'}</span>
                    <span>•</span>
                    <span>{format(new Date(proposal.created_at), 'MMM d, yyyy HH:mm')}</span>
                  </div>

                  {proposal.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReview(proposal.id, 'rejected')}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Reject
                      </button>
                      <button
                        onClick={() => handleReview(proposal.id, 'approved')}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 hover:bg-green-500 rounded transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        Approve
                      </button>
                    </div>
                  )}
                </div>

                {(proposal.review_note || proposal.reviewed_at) && (
                  <div className="mt-3 p-2 bg-[#141414] border border-[#2C2C2C] rounded text-xs text-gray-400">
                    <span className="font-bold text-gray-300">Review Note:</span> {proposal.review_note || 'No notes'}
                    <div className="mt-1 text-gray-600">
                      Reviewed {proposal.reviewed_at ? format(new Date(proposal.reviewed_at), 'MMM d, HH:mm') : ''}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats Bar */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-yellow-400">{counts.pending}</div>
          <div className="text-xs text-gray-400">Pending</div>
        </div>
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-green-400">{counts.approved}</div>
          <div className="text-xs text-gray-400">Approved</div>
        </div>
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-red-400">{counts.rejected}</div>
          <div className="text-xs text-gray-400">Rejected</div>
        </div>
        <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-slate-400">{counts.all}</div>
          <div className="text-xs text-gray-400">Total</div>
        </div>
      </div>
    </div>
  );
}
