import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { 
  Shuffle, 
  CheckCircle2, 
  TrendingUp, 
  Percent, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  ShieldCheck,
  XCircle
} from 'lucide-react';

interface MigrationClaim {
  id: string;
  platform_name: string;
  platform_user_id: string;
  platform_profile_url: string | null;
  proof_screenshot_url: string | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
}

export default function CreatorSwitchProgram() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [claim, setClaim] = useState<MigrationClaim | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    platform_name: '',
    platform_user_id: '',
    platform_profile_url: '',
    proof_screenshot_url: ''
  });

  const fetchClaim = React.useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('creator_migration_claims')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setClaim(data as MigrationClaim);
        // Pre-fill form if pending, so they can edit
        if (data.verification_status === 'pending') {
          setFormData({
            platform_name: data.platform_name,
            platform_user_id: data.platform_user_id,
            platform_profile_url: data.platform_profile_url || '',
            proof_screenshot_url: data.proof_screenshot_url || ''
          });
        }
      }
    } catch (err) {
      console.error('Error fetching claim:', err);
      toast.error('Failed to load application status');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchClaim();
    }
  }, [user, fetchClaim]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.platform_name || !formData.platform_user_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      if (claim) {
        // Update existing pending claim
        const { error } = await supabase
          .from('creator_migration_claims')
          .update({
            platform_name: formData.platform_name,
            platform_user_id: formData.platform_user_id,
            platform_profile_url: formData.platform_profile_url || null,
            proof_screenshot_url: formData.proof_screenshot_url || null,
            // verification_status remains pending
          })
          .eq('id', claim.id)
          .eq('verification_status', 'pending'); // Security check

        if (error) throw error;
        toast.success('Application updated successfully');
      } else {
        // Insert new claim
        const { error } = await supabase
          .from('creator_migration_claims')
          .insert({
            user_id: user.id,
            platform_name: formData.platform_name,
            platform_user_id: formData.platform_user_id,
            platform_profile_url: formData.platform_profile_url || null,
            proof_screenshot_url: formData.proof_screenshot_url || null,
            verification_status: 'pending'
          });

        if (error) {
          if (error.code === '23505') { // Unique violation
            toast.error('You have already submitted an application.');
            fetchClaim(); // Refresh to show it
            return;
          }
          throw error;
        }
        toast.success('Application submitted. Under review.');
      }
      
      fetchClaim();
    } catch (err: any) {
      console.error('Error submitting claim:', err);
      toast.error(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto text-white space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 rounded-full bg-purple-500/20 mb-2">
          <Shuffle className="w-8 h-8 text-purple-400" />
        </div>
        <h1 className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          Creator Switch Program
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
          Streamers from any platform can apply for Founder Perks. Enter your previous platform name and creator ID so we can verify your account.
        </p>
      </div>

      {/* Perks Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1A1A24] p-6 rounded-xl border border-purple-500/20 hover:border-purple-500/50 transition-colors group">
          <div className="w-12 h-12 rounded-lg bg-yellow-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-6 h-6 text-yellow-400" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-white">Founder Badge</h3>
          <p className="text-gray-400 text-sm">
            Get a permanent Founder Badge on your profile to show you were here early.
          </p>
        </div>

        <div className="bg-[#1A1A24] p-6 rounded-xl border border-blue-500/20 hover:border-blue-500/50 transition-colors group">
          <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-white">7-Day Boost</h3>
          <p className="text-gray-400 text-sm">
            Enjoy boosted placement on the homepage for 7 days after approval to jumpstart your audience.
          </p>
        </div>

        <div className="bg-[#1A1A24] p-6 rounded-xl border border-green-500/20 hover:border-green-500/50 transition-colors group">
          <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Percent className="w-6 h-6 text-green-400" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-white">Reduced Fees</h3>
          <p className="text-gray-400 text-sm">
            Keep more of your earnings with 30 days of reduced platform fees (only $1 fee for payouts).
          </p>
        </div>
      </div>

      {/* Status or Form */}
      <div className="bg-[#14141E] rounded-2xl border border-[#2C2C3A] p-8 max-w-3xl mx-auto shadow-xl">
        {claim && claim.verification_status !== 'pending' ? (
          // Final State (Approved/Rejected)
          <div className="text-center space-y-6">
            {claim.verification_status === 'approved' ? (
              <div className="space-y-4">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-green-400">Application Approved!</h2>
                <p className="text-gray-300">
                  Your Founder Perks are now active. Welcome to the family!
                </p>
                <div className="bg-green-500/10 p-4 rounded-lg text-left inline-block w-full max-w-md">
                  <p className="text-sm text-green-300 font-mono mb-1">PLATFORM: {claim.platform_name}</p>
                  <p className="text-sm text-green-300 font-mono">ID: {claim.platform_user_id}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                  <XCircle className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-red-400">Application Rejected</h2>
                <p className="text-gray-300">
                  Unfortunately, we couldn&apos;t verify your account details.
                </p>
                {claim.rejection_reason && (
                  <div className="bg-red-500/10 p-4 rounded-lg text-left">
                    <p className="text-sm font-bold text-red-400 mb-1">Reason:</p>
                    <p className="text-sm text-gray-300">{claim.rejection_reason}</p>
                  </div>
                )}
                <p className="text-sm text-gray-500 pt-4">
                  Please contact support if you believe this is an error.
                </p>
              </div>
            )}
          </div>
        ) : (
          // Form (New or Pending)
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Application Form</h2>
              {claim && (
                <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold border border-yellow-500/30 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  PENDING REVIEW
                </span>
              )}
            </div>
            
            {claim && (
              <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg flex gap-3 mb-6">
                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
                <p className="text-sm text-blue-200">
                  Your application is currently under review. You can update your details below if needed.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Previous Platform Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Twitch, Kick, YouTube"
                  value={formData.platform_name}
                  onChange={(e) => setFormData({...formData, platform_name: e.target.value})}
                  className="w-full bg-[#0A0A10] border border-[#2C2C3A] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Platform Username / ID <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ninja, xQc"
                  value={formData.platform_user_id}
                  onChange={(e) => setFormData({...formData, platform_user_id: e.target.value})}
                  className="w-full bg-[#0A0A10] border border-[#2C2C3A] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Profile URL (Optional)</label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="url"
                  placeholder="https://twitch.tv/username"
                  value={formData.platform_profile_url}
                  onChange={(e) => setFormData({...formData, platform_profile_url: e.target.value})}
                  className="w-full bg-[#0A0A10] border border-[#2C2C3A] rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Proof Screenshot URL (Optional)</label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="url"
                  placeholder="https://imgur.com/..."
                  value={formData.proof_screenshot_url}
                  onChange={(e) => setFormData({...formData, proof_screenshot_url: e.target.value})}
                  className="w-full bg-[#0A0A10] border border-[#2C2C3A] rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <p className="text-xs text-gray-500">
                A screenshot of your logged-in profile page can help speed up verification.
              </p>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 rounded-lg shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01] active:scale-[0.99]"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  claim ? 'Update Application' : 'Submit for Verification'
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-center text-gray-600 text-sm">
        Not affiliated with or endorsed by any platform. Mai Troll is an independent streaming community.
      </p>
    </div>
  );
}
