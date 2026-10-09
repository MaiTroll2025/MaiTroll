
import React, { useCallback, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { X, Gavel, Scale, ExternalLink, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface JudgeRulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseData: any;
  onSuccess: () => void;
}

export default function JudgeRulingModal({ isOpen, onClose, caseData, onSuccess }: JudgeRulingModalProps) {
  const [rulingType, setRulingType] = useState<'dismissed' | 'plaintiff_favored' | 'defendant_favored' | 'sentence_to_jail' | 'release_from_jail' | ''>('');
  const [rulingNotes, setRulingNotes] = useState('');
  const [awardAmount, setAwardAmount] = useState<number>(0);
  const [jailDays, setJailDays] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [attorneyCases, setAttorneyCases] = useState<any[]>([]);

  const isImpeachment = caseData?.category === 'IMPEACHMENT';

  const fetchAttorneyCases = useCallback(async () => {
    if (!caseData?.id) return;

    try {
      const { data, error } = await supabase
        .from('attorney_cases')
        .select(`
          *,
          attorney:attorney_id(username)
        `)
        .eq('case_id', caseData.id)
        .eq('status', 'active');

      if (error) throw error;
      setAttorneyCases(data || []);
    } catch (err) {
      console.error('Error fetching attorney cases:', err);
    }
  }, [caseData?.id]);

  useEffect(() => {
    if (isOpen && caseData?.id) {
      void fetchAttorneyCases();
    }
  }, [isOpen, caseData?.id, fetchAttorneyCases]);

  if (!isOpen || !caseData) return null;

  const handleRuling = async () => {
    if (!rulingType) return toast.error('Please select a verdict');
    if (!rulingNotes) return toast.error('Please provide ruling notes');
    if (rulingType === 'plaintiff_favored' && awardAmount < 0) return toast.error('Award amount cannot be negative');
    if (rulingType === 'sentence_to_jail' && jailDays < 1) return toast.error('Please enter valid jail days');

    setLoading(true);
    try {
      // Handle release from jail
      if (rulingType === 'release_from_jail') {
        const { data: existingJail } = await supabase
          .from('jail')
          .select('id')
          .eq('user_id', caseData.defendant_id)
          .maybeSingle();
        
        if (existingJail) {
          const releaseTime = new Date();
          const { error: releaseError } = await supabase
            .from('jail')
            .update({ 
              release_time: releaseTime.toISOString(),
              status: 'released'
            })
            .eq('id', existingJail.id);
          
          if (releaseError) throw releaseError;
          
          await supabase
            .from('user_profiles')
            .update({ is_jailed: false })
            .eq('id', caseData.defendant_id);
        }
        
        await supabase
          .from('court_cases')
          .update({ status: 'resolved', judgment: rulingNotes })
          .eq('id', caseData.id);
        
        toast.success('Inmate released from jail');
        onSuccess();
        onClose();
        return;
      }

      // Handle sentence to jail
      if (rulingType === 'sentence_to_jail') {
        const releaseTime = new Date();
        releaseTime.setDate(releaseTime.getDate() + jailDays);
        
        // Check if inmate already exists in jail - update instead of insert
        const { data: existingJail } = await supabase
          .from('jail')
          .select('id')
          .eq('user_id', caseData.defendant_id)
          .maybeSingle();
        
        if (existingJail) {
          // Extend existing sentence
          const { error: jailError } = await supabase
            .from('jail')
            .update({
              release_time: releaseTime.toISOString(),
              reason: rulingNotes,
              sentence_days: jailDays,
              status: 'jailed'
            })
            .eq('id', existingJail.id);
          
          if (jailError) throw jailError;
        } else {
          // Insert new jail record
          const { error: jailError } = await supabase
            .from('jail')
            .insert({
              user_id: caseData.defendant_id,
              release_time: releaseTime.toISOString(),
              reason: rulingNotes,
              sentence_days: jailDays,
              arrested_by: null,
              status: 'jailed'
            });
          
          if (jailError) throw jailError;
        }
        
        // Also update user profile is_jailed flag
        await supabase
          .from('user_profiles')
          .update({ is_jailed: true })
          .eq('id', caseData.defendant_id);
        
        // Also update the case status
        await supabase
          .from('court_cases')
          .update({ status: 'resolved', judgment: rulingNotes })
          .eq('id', caseData.id);
        
        toast.success(`Defendant sentenced to ${jailDays} day(s) in jail`);
        onSuccess();
        onClose();
        return;
      }

      // Handle civil rulings directly
      if (rulingType === 'dismissed') {
        // Hard delete the case for dismissed rulings
        const { error: deleteError } = await supabase
          .from('court_cases')
          .delete()
          .eq('id', caseData.id);

        if (deleteError) throw deleteError;

        toast.success('Case dismissed and deleted');
        onSuccess();
        onClose();
        return;
      }

      const updateData: any = { status: 'resolved', judgment: rulingNotes };

      if (rulingType === 'plaintiff_favored' && awardAmount > 0) {
        // Transfer coins from defendant to plaintiff instantly
        const { error: transferError } = await supabase.rpc('transfer_coins', {
          p_from_user_id: caseData.defendant_id,
          p_to_user_id: caseData.plaintiff_id,
          p_amount: awardAmount
        });

        if (transferError) {
          console.error('Coin transfer error:', transferError);
          toast.error('Failed to transfer award amount');
          return;
        }
      }

      const { error: updateError } = await supabase
        .from('court_cases')
        .update(updateData)
        .eq('id', caseData.id);

      if (updateError) throw updateError;

      toast.success('Ruling issued successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error issuing ruling:', err);
      toast.error(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#120F1D] border border-purple-500/30 rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#1A1625]">
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/20 p-2 rounded-lg">
              <Gavel className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Judge&apos;s Chambers</h2>
              <p className="text-xs text-gray-400">Case #{caseData.case_number} • {caseData.category}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 grid md:grid-cols-2 gap-6">
          
          {/* Case Details (Left) */}
          <div className="space-y-6 border-r border-white/5 pr-6">
            <div>
              <h3 className="text-sm font-bold text-purple-400 mb-2 uppercase tracking-wider">Parties Involved</h3>
              <div className="bg-black/20 p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Plaintiff</span>
                  <span className="text-white font-semibold">{caseData.plaintiff?.username}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Defendant</span>
                  <span className="text-white font-semibold">{caseData.defendant?.username}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-purple-400 mb-2 uppercase tracking-wider">Complaint</h3>
              <div className="bg-black/20 p-4 rounded-lg">
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{caseData.description}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-purple-400 mb-2 uppercase tracking-wider">Claim</h3>
              <div className="bg-black/20 p-4 rounded-lg flex justify-between items-center">
                <span className="text-gray-400 text-sm">Seeking Damages</span>
                <span className="text-yellow-400 font-bold">{caseData.claim_amount} Coins</span>
              </div>
            </div>

            {caseData.evidence_url && (
               <div>
                <h3 className="text-sm font-bold text-purple-400 mb-2 uppercase tracking-wider">Evidence</h3>
                <a
                  href={caseData.evidence_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm bg-blue-900/20 p-3 rounded-lg border border-blue-500/20"
                >
                  <ExternalLink size={16} />
                  View Submitted Evidence
                </a>
              </div>
            )}

            {attorneyCases.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-purple-400 mb-2 uppercase tracking-wider">Attorney Notes</h3>
                <div className="space-y-3">
                  {attorneyCases.map((attorneyCase) => (
                    <div key={attorneyCase.id} className="bg-black/20 p-3 rounded-lg border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-gray-500">Attorney:</span>
                        <span className="text-sm font-semibold text-amber-400">{attorneyCase.attorney?.username || 'Unknown'}</span>
                        {attorneyCase.is_pro_bono && (
                          <span className="text-xs bg-amber-900/30 text-amber-300 px-2 py-0.5 rounded">Pro Bono</span>
                        )}
                      </div>
                      {attorneyCase.case_details?.attorney_notes && (
                        <div className="text-gray-300 text-sm whitespace-pre-wrap bg-black/40 p-2 rounded border-l-2 border-amber-500/50">
                          {attorneyCase.case_details.attorney_notes}
                        </div>
                      )}
                      {attorneyCase.case_details?.evidence && attorneyCase.case_details.evidence.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Additional Evidence:</p>
                          <div className="space-y-1">
                            {attorneyCase.case_details.evidence.map((url: string, idx: number) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 block truncate"
                              >
                                {url}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ruling Form (Right) */}
          <div className="space-y-6">
             <div>
              <h3 className="text-sm font-bold text-purple-400 mb-4 uppercase tracking-wider">Official Ruling {isImpeachment && '(IMPEACHMENT TRIBUNAL)'}</h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => setRulingType('dismissed')}
                  className={`w-full p-4 rounded-lg border flex items-center justify-between transition-all ${
                    rulingType === 'dismissed' 
                      ? 'bg-gray-700 border-gray-500 text-white' 
                      : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <span className="font-semibold">Dismiss Case</span>
                  <span className="text-xs">No Action Taken</span>
                </button>

                <button
                  onClick={() => setRulingType('plaintiff_favored')}
                  className={`w-full p-4 rounded-lg border flex items-center justify-between transition-all ${
                    rulingType === 'plaintiff_favored' 
                      ? 'bg-green-900/40 border-green-500 text-green-100' 
                      : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <span className="font-semibold">{isImpeachment ? 'GUILTY (Remove President)' : 'Rule for Plaintiff'}</span>
                  <span className="text-xs">{isImpeachment ? 'Strip Role Immediately' : 'Award Damages'}</span>
                </button>

                <button
                  onClick={() => setRulingType('defendant_favored')}
                  className={`w-full p-4 rounded-lg border flex items-center justify-between transition-all ${
                    rulingType === 'defendant_favored' 
                      ? 'bg-red-900/40 border-red-500 text-red-100' 
                      : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <span className="font-semibold">{isImpeachment ? 'NOT GUILTY (Acquit)' : 'Rule for Defendant'}</span>
                  <span className="text-xs">{isImpeachment ? 'Retain Presidency' : 'No Damages'}</span>
                </button>

                <button
                  onClick={() => setRulingType('sentence_to_jail')}
                  className={`w-full p-4 rounded-lg border flex items-center justify-between transition-all ${
                    rulingType === 'sentence_to_jail' 
                      ? 'bg-red-900/40 border-red-500 text-red-100' 
                      : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <span className="font-semibold flex items-center gap-2">
                    <Lock size={16} />
                    Sentence to Jail
                  </span>
                  <span className="text-xs">Send defendant to jail</span>
                </button>

                <button
                  onClick={() => setRulingType('release_from_jail')}
                  className={`w-full p-4 rounded-lg border flex items-center justify-between transition-all ${
                    rulingType === 'release_from_jail' 
                      ? 'bg-green-900/40 border-green-500 text-green-100' 
                      : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <span className="font-semibold flex items-center gap-2">
                    <Lock size={16} className="rotate-90" />
                    Release from Jail
                  </span>
                  <span className="text-xs">Release inmate if jailed</span>
                </button>
              </div>
            </div>

            {rulingType === 'plaintiff_favored' && !isImpeachment && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-sm font-medium text-gray-300">Award Amount (Coins)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={awardAmount}
                    onChange={(e) => setAwardAmount(parseInt(e.target.value) || 0)}
                    className="w-full bg-black/30 border border-green-500/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
                    placeholder="Enter amount to transfer"
                  />
                  <span className="absolute right-4 top-3 text-gray-500 text-sm">MAX: {caseData.claim_amount}</span>
                </div>
                <p className="text-xs text-gray-500">
                  This amount will be automatically transferred from the Defendant&apos;s balance to the Plaintiff.
                  If the Defendant has insufficient funds, the maximum available balance will be transferred.
                </p>
              </div>
            )}

            {rulingType === 'sentence_to_jail' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-sm font-medium text-gray-300">Jail Sentence (Days)</label>
                <input
                  type="number"
                  value={jailDays}
                  onChange={(e) => setJailDays(parseInt(e.target.value) || 1)}
                  className="w-full bg-black/30 border border-red-500/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-400"
                  min="1"
                  max="365"
                />
                <p className="text-xs text-gray-500">
                  The defendant will be sent to jail for the specified number of days.
                  They will not be able to use most city services while incarcerated.
                </p>
              </div>
            )}

            {isImpeachment && rulingType === 'plaintiff_favored' && (
               <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg animate-in fade-in">
                  <p className="text-red-200 text-sm font-bold flex items-center gap-2">
                    <Gavel size={16} />
                    WARNING: Immediate Removal
                  </p>
                  <p className="text-red-300/70 text-xs mt-1">
                    Confirming this ruling will immediately strip the President of their role and badges. This action is logged and public.
                  </p>
               </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Ruling Notes / Justification</label>
              <textarea
                value={rulingNotes}
                onChange={(e) => setRulingNotes(e.target.value)}
                placeholder="Explain the reasoning for this verdict..."
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white h-32 resize-none focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-[#1A1625] flex items-center justify-between">
          <div className="text-xs text-gray-500">
            * All rulings are final and recorded in the immutable court ledger.
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRuling}
              disabled={loading || !rulingType || !rulingNotes}
              className={`px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-all flex items-center gap-2 ${
                (loading || !rulingType || !rulingNotes) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Submitting...' : 'Issue Final Ruling'}
              <Scale size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
