import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { 
  AlertTriangle, ArrowLeft, BarChart3, Check, CheckCircle2, Clock, Eye, Gavel, Package, Settings, User, Users, X
} from 'lucide-react';

interface AuctionReport {
  id: string;
  reporter_id: string;
  reporter_role: string;
  reported_user_id: string;
  auction_show_id: string;
  lot_id: string | null;
  reason: string;
  notes: string | null;
  status: 'open' | 'under_review' | 'action_taken' | 'dismissed';
  resolution_notes: string | null;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reporter?: {
    username: string;
    avatar_url: string;
  };
  reported_user?: {
    username: string;
    avatar_url: string;
  };
  show?: {
    title: string;
    status: string;
  };
  lot?: {
    title: string;
  };
}

export default function AuctionReports() {
  const _user = useAuthStore();
  const [reports, setReports] = useState<AuctionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<AuctionReport | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('auction_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const reviewReport = async (reportId: string, status: string) => {
    if (!reviewNotes.trim()) {
      toast.error('Please provide resolution notes');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('review_auction_report', {
        p_report_id: reportId,
        p_status: status,
        p_resolution_notes: reviewNotes
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success('Report reviewed successfully');
      setSelectedReport(null);
      setReviewNotes('');
      fetchReports();
    } catch (error: any) {
      toast.error(error.message || 'Failed to review report');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: any }> = {
      open: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
      under_review: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Clock },
      action_taken: { bg: 'bg-green-500/20', text: 'text-green-400', icon: Check },
      dismissed: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: X }
    };
    return styles[status] || styles.open;
  };

  const filteredReports = reports.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const navigate = useNavigate();

  const navItems = [
    { label: 'My Shows', icon: Gavel, route: '/auctions/studio' },
    { label: 'Inventory', icon: Package, route: '/auctions/inventory' },
    { label: 'Bidders', icon: Users, route: '/auctions/bidders' },
    { label: 'Sales', icon: CheckCircle2, route: '/auctions/sales' },
    { label: 'Analytics', icon: BarChart3, route: '/auctions/analytics' },
    { label: 'Settings', icon: Settings, route: '/auctions/settings' },
  ];

  return (
    <div className="bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Nav bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => navigate('/auctions/studio')}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Studio
          </button>
          <div className="flex flex-wrap items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.route)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900/60 px-2.5 py-1.5 text-[11px] font-bold text-gray-400 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-200"
                >
                  <Icon className="h-3 w-3" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Auction Reports</h1>
            <p className="text-gray-400">Review and manage auction-related reports</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {['open', 'under_review', 'action_taken', 'dismissed'].map((status) => {
            const count = reports.filter(r => r.status === status).length;
            const style = getStatusBadge(status);
            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`p-4 border rounded-xl text-left transition-all ${
                  filter === status 
                    ? 'border-red-500/50 bg-red-500/10' 
                    : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                }`}
              >
                <div className={`flex items-center gap-2 ${style.text} mb-1`}>
                  <style.icon className="w-4 h-4" />
                  <span className="text-sm capitalize">{status.replace('_', ' ')}</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
              </button>
            );
          })}
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 mt-4">Loading reports...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 rounded-2xl border border-gray-800">
            <AlertTriangle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-400 mb-2">No Reports Found</h3>
            <p className="text-gray-500">
              {filter === 'all' ? 'No auction reports at this time' : `No ${filter.replace('_', ' ')} reports`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => {
              const style = getStatusBadge(report.status);
              return (
                <div
                  key={report.id}
                  className="p-4 bg-gray-900/50 border border-gray-800 hover:border-red-500/30 rounded-xl transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1 ${style.bg} ${style.text}`}>
                          <style.icon className="w-3 h-3" />
                          {report.status.replace('_', ' ')}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(report.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <p className="text-white font-medium mb-1">{report.reason}</p>
                      {report.notes && (
                        <p className="text-gray-400 text-sm mb-2">{report.notes}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          Reporter: {report.reporter_role}
                        </span>
                        {report.show && (
                          <span className="flex items-center gap-1">
                            <Gavel className="w-4 h-4" />
                            {report.show.title}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedReport(report)}
                      className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Review Modal */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="text-xl font-bold">Review Report</h2>
                <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-gray-800 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Reason</label>
                  <p className="text-white font-medium">{selectedReport.reason}</p>
                </div>
                
                {selectedReport.notes && (
                  <div>
                    <label className="text-sm text-gray-400">Notes</label>
                    <p className="text-gray-300">{selectedReport.notes}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm text-gray-400">Reporter Role</label>
                  <p className="text-white capitalize">{selectedReport.reporter_role.replace('_', ' ')}</p>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Resolution Notes *</label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                    placeholder="Describe the action taken or reason for dismissal..."
                    className="w-full mt-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-red-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-gray-800">
                <button
                  onClick={() => reviewReport(selectedReport.id, 'dismissed')}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => reviewReport(selectedReport.id, 'action_taken')}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50"
                >
                  Take Action
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}