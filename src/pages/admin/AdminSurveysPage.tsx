import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  Plus,
  Trash2,
  Eye,
  Download,
  Send,
  Loader2,
  X,
  CheckCircle2,
  BarChart3,
  Users,
  Calendar,
  ToggleLeft,
  ToggleRight,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/lib/store';
import {
  getAllSurveys,
  getSurveyResponses,
  createSurvey,
  deleteSurvey,
  toggleSurveyActive,
  exportResponsesCSV,
  notifySurveyAvailable,
} from '@/lib/survey';
import { getTromailRoleDirectory, sendTromailMessage, getUserTromailAccount } from '@/lib/tromail';
import type { SurveyWithResponseCount, SurveyResponse } from '@/types/survey';
import type { TromailAccount } from '@/lib/tromail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type SurveysTab = 'list' | 'create' | 'responses' | 'share';

export default function AdminSurveysPage() {
  const { user, profile } = useAuthStore();

  const [activeTab, setActiveTab] = useState<SurveysTab>('list');
  const [surveys, setSurveys] = useState<SurveyWithResponseCount[]>([]);
  const [loading, setLoading] = useState(false);

  // Create form
  const [newTitle, setNewTitle] = useState('Weekly Mai Troll Survey');
  const [newDescription, setNewDescription] = useState('');
  const [newWeekStart, setNewWeekStart] = useState('');
  const [newWeekEnd, setNewWeekEnd] = useState('');
  const [creating, setCreating] = useState(false);

  // Responses
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  // Share
  const [directory, setDirectory] = useState<TromailAccount[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  const loadSurveys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllSurveys();
      setSurveys(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  useEffect(() => {
    if (activeTab === 'share') {
      getTromailRoleDirectory().then(setDirectory).catch(console.error);
    }
  }, [activeTab]);

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setCreating(true);
    try {
      const result = await createSurvey({
        title: newTitle,
        description: newDescription || undefined,
        week_start_date: newWeekStart,
        week_end_date: newWeekEnd,
        created_by: user.id,
      });

      if (result.success) {
        toast.success('Survey created successfully');
        setNewTitle('Weekly Mai Troll Survey');
        setNewDescription('');
        setNewWeekStart('');
        setNewWeekEnd('');
        setActiveTab('list');
        loadSurveys();
      } else {
        toast.error(result.error || 'Failed to create survey');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleViewResponses = async (surveyId: string) => {
    setSelectedSurveyId(surveyId);
    setActiveTab('responses');
    setLoadingResponses(true);
    try {
      console.log('[AdminSurveys] Viewing responses for survey:', surveyId);
      console.log('[AdminSurveys] Current user:', user?.id, 'role:', profile?.role, 'is_admin:', profile?.is_admin);
      const data = await getSurveyResponses(surveyId);
      console.log('[AdminSurveys] Responses fetched:', data.length, data);
      setResponses(data);
    } catch (err) {
      console.error('[AdminSurveys] Error fetching responses:', err);
    } finally {
      setLoadingResponses(false);
    }
  };

  const handleDownloadCSV = async (surveyId: string) => {
    const survey = surveys.find(s => s.id === surveyId);
    const data = await getSurveyResponses(surveyId);
    const csv = exportResponsesCSV(data, survey);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey-responses-${surveyId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const handleDownloadAll = async () => {
    const allResponses = await getAllResponses();
    const csv = exportResponsesCSV(allResponses);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all-survey-responses.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('All responses downloaded');
  };

  const handleToggleActive = async (surveyId: string, currentActive: boolean) => {
    const success = await toggleSurveyActive(surveyId, !currentActive);
    if (success) {
      toast.success(`Survey ${!currentActive ? 'activated' : 'deactivated'}`);
      loadSurveys();
    } else {
      toast.error('Failed to update survey');
    }
  };

  const handleDelete = async (surveyId: string) => {
    if (!confirm('Delete this survey and all its responses?')) return;
    const success = await deleteSurvey(surveyId);
    if (success) {
      toast.success('Survey deleted');
      loadSurveys();
    } else {
      toast.error('Failed to delete survey');
    }
  };

  const handleShareViaTromail = async () => {
    if (!selectedSurveyId || selectedRoles.length === 0 || !user?.id) {
      toast.error('Select a survey and at least one role');
      return;
    }

    setSharing(true);
    try {
      const survey = surveys.find(s => s.id === selectedSurveyId);
      if (!survey) return;

      const senderAccount = await getUserTromailAccount(user.id);
      const targetUsers = directory.filter(a => selectedRoles.includes(a.role));

      if (targetUsers.length === 0) {
        toast.error('No users found for selected roles');
        return;
      }

      const result = await sendTromailMessage({
        sender_user_id: user.id,
        sender_role: profile?.role || 'admin',
        sender_tromail_address: senderAccount?.email_address || 'system@tromail.Mai Troll',
        subject: `📋 Weekly Survey: ${survey.title}`,
        body: `A new weekly survey is available!\n\n${survey.title}\n${survey.description || ''}\n\nClick to take the survey: /survey/${survey.id}\n\nYour feedback helps improve Mai Troll!`,
        is_admin_email: true,
        is_important: true,
        recipient_user_ids: targetUsers.map(a => a.user_id),
        recipient_roles: targetUsers.map(a => a.role),
      });

      if (result.success) {
        toast.success(`Survey shared with ${targetUsers.length} users via Tromail`);
        setSelectedRoles([]);
      } else {
        toast.error(result.error || 'Failed to share');
      }
    } finally {
      setSharing(false);
    }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const uniqueRoles = [...new Set(directory.map(a => a.role))].sort();

  const tabs: Array<{ id: SurveysTab; label: string; icon: any }> = [
    { id: 'list', label: 'All Surveys', icon: ClipboardList },
    { id: 'create', label: 'Create Survey', icon: Plus },
    { id: 'responses', label: 'Responses', icon: BarChart3 },
    { id: 'share', label: 'Share via Tromail', icon: Send },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white">
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Survey Management</h1>
            <p className="text-gray-400 text-sm">Create, manage, and share weekly surveys</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-purple-500/20 pb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'border border-purple-400/30 bg-purple-500/20 text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.13)]'
                  : 'border border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'list' && (
            <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex justify-end mb-4">
                <Button onClick={handleDownloadAll} variant="ghost" className="text-purple-300 hover:text-purple-200 border border-purple-500/20">
                  <Download className="mr-2 h-4 w-4" />
                  Download All Responses (CSV)
                </Button>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                </div>
              ) : surveys.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-purple-500/20 bg-slate-950/60">
                  <ClipboardList className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No surveys yet. Create your first survey!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {surveys.map(survey => (
                    <div key={survey.id} className="rounded-xl border border-purple-500/20 bg-slate-950/60 p-4 flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-white truncate">{survey.title}</h3>
                          {survey.is_active ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">ACTIVE</span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400">INACTIVE</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {survey.week_start_date} — {survey.week_end_date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {survey.response_count} responses
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button onClick={() => handleViewResponses(survey.id)} variant="ghost" size="sm" className="text-purple-300 hover:text-purple-200">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => handleDownloadCSV(survey.id)} variant="ghost" size="sm" className="text-blue-300 hover:text-blue-200">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => handleToggleActive(survey.id, survey.is_active)} variant="ghost" size="sm" className={survey.is_active ? 'text-yellow-300' : 'text-green-300'}>
                          {survey.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        </Button>
                        <Button onClick={() => handleDelete(survey.id)} variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'create' && (
            <motion.div key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <form onSubmit={handleCreateSurvey} className="rounded-2xl border border-purple-500/20 bg-slate-950/60 p-6 space-y-4 max-w-2xl">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Survey Title</label>
                  <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Weekly Mai Troll Survey" className="mt-1 border-purple-500/30 bg-slate-900/60 text-white" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Description</label>
                  <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Optional description..." rows={3} className="mt-1 border-purple-500/30 bg-slate-900/60 text-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Week Start</label>
                    <Input type="date" value={newWeekStart} onChange={e => setNewWeekStart(e.target.value)} className="mt-1 border-purple-500/30 bg-slate-900/60 text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Week End</label>
                    <Input type="date" value={newWeekEnd} onChange={e => setNewWeekEnd(e.target.value)} className="mt-1 border-purple-500/30 bg-slate-900/60 text-white" />
                  </div>
                </div>
                <div className="rounded-xl border border-purple-500/10 bg-purple-500/5 p-3 text-xs text-purple-200">
                  <p className="font-semibold mb-1">Default Questions:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-purple-300">
                    <li>What needs to be changed?</li>
                    <li>Any issues you are experiencing?</li>
                    <li>What would you like to see next?</li>
                  </ul>
                </div>
                <Button type="submit" disabled={creating || !newTitle.trim() || !newWeekStart || !newWeekEnd} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500">
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Create Survey
                </Button>
              </form>
            </motion.div>
          )}

          {activeTab === 'responses' && (
            <motion.div key="responses" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {!selectedSurveyId ? (
                <div className="text-center py-12 rounded-2xl border border-purple-500/20 bg-slate-950/60">
                  <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Select a survey from the list to view responses</p>
                  <Button onClick={() => setActiveTab('list')} variant="ghost" className="mt-3 text-purple-300">
                    Go to Surveys
                  </Button>
                </div>
              ) : loadingResponses ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
                </div>
              ) : responses.length === 0 ? (
                <div className="space-y-4">
                  <div className="text-center py-12 rounded-2xl border border-purple-500/20 bg-slate-950/60">
                    <FileText className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No responses yet for this survey</p>
                  </div>
                  {/* DEBUG PANEL */}
                  <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/20 p-4 text-xs font-mono">
                    <p className="text-yellow-300 font-bold mb-2">🔍 DEBUG INFO</p>
                    <p className="text-yellow-200">User ID: {user?.id || 'NULL'}</p>
                    <p className="text-yellow-200">Role: {profile?.role || 'NULL'}</p>
                    <p className="text-yellow-200">Is Admin: {String(profile?.is_admin)}</p>
                    <p className="text-yellow-200">Survey ID: {selectedSurveyId}</p>
                    <p className="text-yellow-200">Responses Found: {responses.length}</p>
                    <p className="text-yellow-400 mt-2">Check browser console (F12) for more details</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-slate-400">{responses.length} response{responses.length !== 1 ? 's' : ''}</p>
                    <Button onClick={() => handleDownloadCSV(selectedSurveyId)} variant="ghost" size="sm" className="text-purple-300">
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>
                  {responses.map((response, idx) => {
                    const answers = typeof response.answers === 'string' ? JSON.parse(response.answers) : response.answers;
                    return (
                      <div key={response.id} className="rounded-xl border border-purple-500/20 bg-slate-950/60 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-bold text-purple-300">Response #{responses.length - idx}</span>
                          <span className="text-xs text-slate-500">{new Date(response.submitted_at).toLocaleString()}</span>
                        </div>
                        <div className="space-y-2">
                          {Object.entries(answers || {}).map(([key, value]) => (
                            <div key={key} className="text-sm">
                              <span className="font-semibold text-slate-300 capitalize">{key}:</span>{' '}
                              <span className="text-slate-400">{String(value) || <span className="italic text-slate-600">No response</span>}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'share' && (
            <motion.div key="share" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="rounded-2xl border border-purple-500/20 bg-slate-950/60 p-6 space-y-6 max-w-2xl">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Select Survey to Share</label>
                  <select
                    value={selectedSurveyId || ''}
                    onChange={e => setSelectedSurveyId(e.target.value || null)}
                    className="mt-1 w-full rounded-lg border border-purple-500/30 bg-slate-900/60 text-white p-2 text-sm"
                  >
                    <option value="">Choose a survey...</option>
                    {surveys.filter(s => s.is_active).map(s => (
                      <option key={s.id} value={s.id}>{s.title} ({s.week_start_date})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2 block">Share with Roles</label>
                  <div className="flex flex-wrap gap-2">
                    {uniqueRoles.map(role => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                          selectedRoles.includes(role)
                            ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40'
                            : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {role.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleShareViaTromail}
                  disabled={sharing || !selectedSurveyId || selectedRoles.length === 0}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                >
                  {sharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send via Tromail ({selectedRoles.length} roles)
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
