import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PiggyBank,
  ChevronLeft,
  Loader,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { maiBusinessApi, type BusinessFunding } from '@/features/mai-business/lib/maiBusinessApi';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

const statusColors: Record<string, string> = {
  draft: 'bg-zinc-800/30 text-zinc-400',
  submitted: 'bg-amber-500/10 text-amber-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-rose-500/10 text-rose-400',
};

const statusIcons: Record<string, React.ReactNode> = {
  draft: <Clock size={16} />,
  submitted: <AlertCircle size={16} />,
  approved: <CheckCircle size={16} />,
  rejected: <XCircle size={16} />,
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function MaiBusinessFunding() {
  const navigate = useNavigate();
  const [funding, setFunding] = useState<BusinessFunding[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'submitted' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await maiBusinessApi.getFunding();
        setFunding(data);
      } catch (err) {
        console.error('Error fetching funding:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = filter === 'all' ? funding : funding.filter(f => f.status === filter);

  const totalRequested = funding.reduce((sum, f) => sum + Number(f.amount || 0), 0);
  const totalApproved = funding.filter(f => f.status === 'approved').reduce((sum, f) => sum + Number(f.amount || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <Loader size={24} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-12">
      <div className="container mx-auto px-4 pt-8">
        <div className="mb-8">
          <button onClick={() => navigate('/mai-business/dashboard')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4">
            <ChevronLeft size={16} /> Back to Dashboard
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-black">
              Funding Hub
              <span className="block text-zinc-400 text-xl font-medium mt-1">Funding Applications</span>
            </h1>
            <button
              onClick={() => navigate('/mai-business/funding/apply')}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold rounded-xl hover:from-purple-400 hover:to-cyan-400 transition-all flex items-center gap-2"
            >
              <PiggyBank size={16} />
              Apply for Funding
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className={`p-6 rounded-2xl ${glass} text-center`}>
            <div className="text-2xl font-black text-purple-400">${totalRequested.toLocaleString()}</div>
            <div className="text-sm text-zinc-500 mt-1">Total Requested</div>
          </div>
          <div className={`p-6 rounded-2xl ${glass} text-center`}>
            <div className="text-2xl font-black text-emerald-400">${totalApproved.toLocaleString()}</div>
            <div className="text-sm text-zinc-500 mt-1">Total Approved</div>
          </div>
          <div className={`p-6 rounded-2xl ${glass} text-center`}>
            <div className="text-2xl font-black text-cyan-400">{funding.length}</div>
            <div className="text-sm text-zinc-500 mt-1">Applications</div>
          </div>
        </div>

        <div className={`p-6 rounded-2xl ${glass}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">My Funding Applications</h2>
            <div className="flex gap-2">
              <Filter size={16} className="text-zinc-500" />
              {(['all', 'draft', 'submitted', 'approved', 'rejected'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1 rounded-lg text-sm transition-all ${
                    filter === status
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                      : 'text-zinc-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {statusLabels[status]}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <PiggyBank size={48} className="mx-auto text-zinc-600 mb-4" />
              <p className="text-zinc-400 mb-2">No funding applications found.</p>
              {filter !== 'all' && (
                <button onClick={() => setFilter('all')} className="text-cyan-400 hover:text-cyan-300">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((f) => (
                <div key={f.id} className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700 hover:border-cyan-400/20 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${statusColors[f.status] || statusColors.draft}`}>
                        {statusIcons[f.status] || statusIcons.draft}
                      </div>
                      <div>
                        <div className="font-medium text-white">{f.funding_type || 'General Funding'}</div>
                        <div className="text-sm text-zinc-500">
                          ${Number(f.amount || 0).toLocaleString()} • Applied {new Date(f.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColors[f.status] || statusColors.draft}`}>
                      {statusLabels[f.status] || 'Draft'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
