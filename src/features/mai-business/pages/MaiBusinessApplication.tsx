import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  ChevronLeft,
  DollarSign,
} from 'lucide-react';
import { maiBusinessApi } from '@/features/mai-business/lib/maiBusinessApi';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

const fundingTypes = [
  { value: 'seed', label: 'Seed Funding', description: 'Early-stage funding to validate your idea' },
  { value: 'startup', label: 'Startup Loan', description: 'Loans for new businesses with revenue potential' },
  { value: 'growth', label: 'Growth Capital', description: 'Funding for scaling an established business' },
  { value: 'innovation', label: 'Innovation Grant', description: 'Non-repayable grants for innovative solutions' },
  { value: 'general', label: 'General Purpose', description: 'Flexible funding for business operations' },
];

export default function MaiBusinessApplication() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    funding_type: 'seed',
    amount: 0,
    purpose: '',
    business_plan_ref: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await maiBusinessApi.createFundingSubmission(form);
      if (result) {
        toast.success('Funding application submitted!');
        navigate('/mai-business/funding');
      } else {
        toast.error('Failed to submit application');
      }
    } catch {
      toast.error('Error submitting application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-12">
      <div className="container mx-auto px-4 pt-8">
        <div className="mb-8">
          <button onClick={() => navigate('/mai-business/funding')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4">
            <ChevronLeft size={16} /> Back to Funding Hub
          </button>
          <h1 className="text-3xl font-black">
            Apply for Funding
            <span className="block text-zinc-400 text-xl font-medium mt-1">New Application</span>
          </h1>
        </div>

        <div className={`p-8 rounded-2xl ${glass} max-w-4xl mx-auto`}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-zinc-300 text-sm font-medium mb-2 block">Funding Type</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fundingTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setForm({ ...form, funding_type: type.value })}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      form.funding_type === type.value
                        ? 'border-cyan-400/40 bg-cyan-500/5 text-white'
                        : 'border-zinc-700 text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    <div className="font-medium">{type.label}</div>
                    <div className="text-xs text-zinc-500 mt-1">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-zinc-300 text-sm font-medium mb-2 block">Amount Requested ($)</label>
              <div className="relative">
                <DollarSign size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                  min="0"
                  step="1000"
                  placeholder="e.g. 25000"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-zinc-300 text-sm font-medium mb-2 block">Purpose / Use of Funds</label>
              <textarea
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-cyan-400 resize-y min-h-[150px]"
                placeholder="Describe how you will use the funds..."
                required
              />
            </div>

            <div>
              <label className="text-zinc-300 text-sm font-medium mb-2 block">Business Plan Reference</label>
              <input
                type="text"
                value={form.business_plan_ref}
                onChange={(e) => setForm({ ...form, business_plan_ref: e.target.value })}
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                placeholder="Link to your business plan (optional)"
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
              <button
                type="button"
                onClick={() => navigate('/mai-business/funding')}
                className="px-6 py-3 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold rounded-xl hover:from-purple-400 hover:to-cyan-400 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Send size={16} />
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
