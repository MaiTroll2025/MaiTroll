import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Loader,
  Users,
  BarChart3,
  FileText,
  CheckSquare,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { maiBusinessApi, type RecognitionRequest, type CollegeContribution } from '@/features/mai-business/lib/maiBusinessApi';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function MaiBusinessAdmin() {
  const navigate = useNavigate();
  const [recognitionRequests, setRecognitionRequests] = useState<RecognitionRequest[]>([]);
  const [contributions, setContributions] = useState<CollegeContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recognition' | 'contributions' | 'analytics'>('recognition');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [rec, contrib] = await Promise.all([
          maiBusinessApi.getRecognitionRequests(),
          maiBusinessApi.getCollegeContributions(),
        ]);
        setRecognitionRequests(rec);
        setContributions(contrib);
     } catch {
        console.error('Error fetching admin data:');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRecognition = async (id: string, status: 'fulfilled' | 'denied') => {
    try {
      const result = await maiBusinessApi.updateRecognitionRequest(id, status);
      if (result) {
        toast.success(`Recognition request ${status}ed!`);
        setRecognitionRequests(prev =>
          prev.map(r => r.id === id ? { ...r, status } : r)
        );
      }
    } catch {
      toast.error('Failed to update recognition request');
    }
  };

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
              MAI Business Admin
              <span className="block text-zinc-400 text-xl font-medium mt-1">
                Administration & Moderation
              </span>
            </h1>
            <Settings size={20} className="text-zinc-500" />
          </div>
        </div>

        <div className="flex gap-4 mb-6 border-b border-zinc-800">
          {[
            { id: 'recognition', title: 'Recognition Requests', icon: CheckSquare },
            { id: 'contributions', title: 'Contributions', icon: BarChart3 },
            { id: 'analytics', title: 'Analytics', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 px-4 flex items-center gap-2 transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'text-cyan-300 border-cyan-400'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300'
                }`}
              >
                <Icon size={16} />
                {tab.title}
              </button>
            );
          })}
        </div>

        {activeTab === 'recognition' && (
          <div className={`p-6 rounded-2xl ${glass}`}>
            <h2 className="text-xl font-bold text-white mb-4">Recognition Requests</h2>
            {recognitionRequests.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <CheckSquare size={32} className="mx-auto mb-2 opacity-30" />
                No recognition requests at this time.
              </div>
            ) : (
              <div className="space-y-4">
                {recognitionRequests.map((req) => (
                  <div key={req.id} className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-white">{req.recognition_type || 'Recognition'}</h3>
                        <p className="text-sm text-zinc-400 mt-1">{req.reason}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                          <span>Requested: {new Date(req.created_at).toLocaleDateString()}</span>
                          <span className={`px-2 py-0.5 rounded-full ${
                            req.status === 'fulfilled' ? 'bg-emerald-500/10 text-emerald-400'
                            : req.status === 'denied' ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {req.status}</span>
                        </div>
                      </div>
                      {req.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRecognition(req.id, 'fulfilled')}
                            className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500/20"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRecognition(req.id, 'denied')}
                            className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'contributions' && (
          <div className={`p-6 rounded-2xl ${glass}`}>
            <h2 className="text-xl font-bold text-white mb-4">College Contributions</h2>
            {contributions.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
                No contributions recorded.
              </div>
            ) : (
              <div className="space-y-4">
                {contributions.map((contrib) => (
                  <div key={contrib.id} className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700">
                    <div className="flex justify-between">
                      <div>
                        <h3 className="font-bold text-white">{contrib.institution_id}</h3>
                        <p className="text-sm text-zinc-400 mt-1">
                          Week: {new Date(contrib.week_start).toLocaleDateString()} - {new Date(contrib.week_end).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">
                          Revenue: ${Number(contrib.qualifying_revenue).toLocaleString()} | Rate: {(Number(contrib.contribution_rate) * 100).toFixed(2)}%
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-amber-400">${Number(contrib.contribution_amount).toLocaleString()}</div>
                        <div className="text-xs text-zinc-500">
                          <span className={`px-2 py-0.5 rounded-full ${contrib.is_approved ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {contrib.is_approved ? 'Approved' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className={`p-6 rounded-2xl ${glass}`}>
            <h2 className="text-xl font-bold text-white mb-4">Platform Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
              <div>
                <Users size={32} className="mx-auto text-purple-400 mb-2" />
                <div className="text-2xl font-black text-white">{recognitionRequests.length}</div>
                <div className="text-sm text-zinc-500">Recognition Requests</div>
              </div>
              <div>
                <FileText size={32} className="mx-auto text-cyan-400 mb-2" />
                <div className="text-2xl font-black text-white">{contributions.length}</div>
                <div className="text-sm text-zinc-500">Contributions</div>
              </div>
              <div>
                <CheckSquare size={32} className="mx-auto text-emerald-400 mb-2" />
                <div className="text-2xl font-black text-white">
                  {recognitionRequests.filter(r => r.status === 'fulfilled').length}
                </div>
                <div className="text-sm text-zinc-500">Approved</div>
              </div>
              <div>
                <AlertTriangle size={32} className="mx-auto text-amber-400 mb-2" />
                <div className="text-2xl font-black text-white">
                  {recognitionRequests.filter(r => r.status === 'pending').length}
                </div>
                <div className="text-sm text-zinc-500">Pending Review</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
