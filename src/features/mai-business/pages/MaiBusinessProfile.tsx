import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Save,
  ChevronLeft,
  Edit,
  Loader,
} from 'lucide-react';
import { maiBusinessApi, type BusinessProfile } from '@/features/mai-business/lib/maiBusinessApi';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

const businessStages = [
  { value: 'exploring', label: 'Exploring Entrepreneurship' },
  { value: 'preparing', label: 'Preparing to Start' },
  { value: 'starting', label: 'Starting a Business' },
  { value: 'existing', label: 'Existing Business' },
];

export default function MaiBusinessProfile() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    business_name: '',
    business_idea: '',
    business_stage: 'exploring' as BusinessProfile['business_stage'],
    industry: '',
    monthly_budget: 0,
    funding_requested: 0,
    founder_name: '',
  });

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await maiBusinessApi.getBusiness();
        if (data) {
          setBusiness(data);
          setForm({
            business_name: data.business_name || '',
            business_idea: data.business_idea || '',
            business_stage: data.business_stage || 'exploring',
            industry: data.industry || '',
            monthly_budget: Number(data.monthly_budget || 0),
            funding_requested: Number(data.funding_requested || 0),
            founder_name: data.founder_name || profile?.display_name || profile?.username || '',
          });
        } else {
          setForm(prev => ({ ...prev, founder_name: profile?.display_name || profile?.username || '' }));
        }
      } catch (err) {
        console.error('Error fetching business:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await maiBusinessApi.upsertBusiness(form);
      if (result) {
        setBusiness(result);
        toast.success('Business profile saved!');
        setIsEditing(false);
      } else {
        toast.error('Failed to save business profile');
      }
    } catch {
      toast.error('Error saving business profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
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
              My Business
              <span className="block text-zinc-300 text-xl font-medium mt-1">Business Profile</span>
            </h1>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`p-3 rounded-xl transition-all ${
                isEditing
                  ? 'bg-zinc-800 text-white'
                  : 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              }`}
            >
              {isEditing ? 'Cancel' : <Edit size={18} />}
            </button>
          </div>
        </div>

        <div className={`p-8 rounded-2xl ${glass}`}>
          {business ? (
            <div className="space-y-6">
              <div>
                <label className="text-zinc-400 text-sm font-medium">Business Name</label>
                <p className="text-white text-lg mt-1">{business.business_name || 'Not set'}</p>
              </div>
              <div>
                <label className="text-zinc-400 text-sm font-medium">Business Idea</label>
                <p className="text-zinc-300 mt-1 whitespace-pre-wrap">{business.business_idea || 'Not set'}</p>
              </div>
              <div>
                <label className="text-zinc-400 text-sm font-medium">Business Stage</label>
                <p className="text-white mt-1">
                  {businessStages.find(s => s.value === business.business_stage)?.label || 'Not set'}
                </p>
              </div>
              <div>
                <label className="text-zinc-400 text-sm font-medium">Industry</label>
                <p className="text-white mt-1">{business.industry || 'Not set'}</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-zinc-400 text-sm font-medium">Monthly Budget</label>
                  <p className="text-white mt-1">${Number(business.monthly_budget || 0).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-zinc-400 text-sm font-medium">Funding Requested</label>
                  <p className="text-white mt-1">${Number(business.funding_requested || 0).toLocaleString()}</p>
                </div>
              </div>
              <div>
                <label className="text-zinc-400 text-sm font-medium">Founder</label>
                <p className="text-white mt-1">{business.founder_name || 'Not set'}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Briefcase size={48} className="mx-auto text-zinc-600 mb-4" />
              <p className="text-zinc-400 mb-6">You haven&apos;t set up your business profile yet.</p>
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold rounded-xl hover:from-purple-400 hover:to-cyan-400 transition-all"
              >
                Set Up Business Profile
              </button>
            </div>
          )}
        </div>

        {isEditing && (
          <div className={`mt-6 p-8 rounded-2xl ${glass}`}>
            <h2 className="text-xl font-bold text-white mb-6">Edit Business Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-zinc-300 text-sm font-medium mb-2 block">Business Name</label>
                <input
                  type="text"
                  value={form.business_name}
                  onChange={e => handleChange('business_name', e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                  placeholder="e.g. My Startup LLC"
                />
              </div>
              <div>
                <label className="text-zinc-300 text-sm font-medium mb-2 block">Industry</label>
                <input
                  type="text"
                  value={form.industry}
                  onChange={e => handleChange('industry', e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                  placeholder="e.g. Technology, Food, Retail"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-zinc-300 text-sm font-medium mb-2 block">Business Idea</label>
                <textarea
                  value={form.business_idea}
                  onChange={e => handleChange('business_idea', e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 resize-y min-h-[120px]"
                  placeholder="Describe your business idea..."
                />
              </div>
              <div>
                <label className="text-zinc-300 text-sm font-medium mb-2 block">Business Stage</label>
                <select
                  value={form.business_stage}
                  onChange={e => handleChange('business_stage', e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                >
                  {businessStages.map(stage => (
                    <option key={stage.value} value={stage.value}>{stage.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-zinc-300 text-sm font-medium mb-2 block">Founder Name</label>
                <input
                  type="text"
                  value={form.founder_name}
                  onChange={e => handleChange('founder_name', e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="text-zinc-300 text-sm font-medium mb-2 block">Monthly Budget ($)</label>
                <input
                  type="number"
                  value={form.monthly_budget}
                  onChange={e => handleChange('monthly_budget', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                  min="0"
                  step="100"
                />
              </div>
              <div>
                <label className="text-zinc-300 text-sm font-medium mb-2 block">Funding Requested ($)</label>
                <input
                  type="number"
                  value={form.funding_requested}
                  onChange={e => handleChange('funding_requested', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                  min="0"
                  step="1000"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-3 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold rounded-xl hover:from-purple-400 hover:to-cyan-400 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Business Profile'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
