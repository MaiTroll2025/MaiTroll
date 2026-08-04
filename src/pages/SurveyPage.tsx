import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, Send, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/lib/store';
import { getSurveyById, hasUserRespondedToSurvey, submitSurveyResponse } from '@/lib/survey';
import type { WeeklySurvey, SurveyQuestion } from '@/types/survey';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function SurveyPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [survey, setSurvey] = useState<WeeklySurvey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    if (!surveyId || !user?.id) return;

    const load = async () => {
      setLoading(true);
      try {
        const s = await getSurveyById(surveyId);
        setSurvey(s);

        if (s) {
          const responded = await hasUserRespondedToSurvey(surveyId, user.id);
          setAlreadySubmitted(responded);

          const initAnswers: Record<string, string> = {};
          (s.questions || []).forEach((q: SurveyQuestion) => {
            initAnswers[q.id] = '';
          });
          setAnswers(initAnswers);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [surveyId, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!surveyId || !user?.id || submitting) return;

    setSubmitting(true);
    try {
      const result = await submitSurveyResponse(surveyId, user.id, answers);
      if (result.success) {
        toast.success('Thank you for your feedback!');
        setAlreadySubmitted(true);
      } else {
        toast.error(result.error || 'Failed to submit');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center p-4">
        <div className="text-center">
          <ClipboardList className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Survey Not Found</h2>
          <p className="text-slate-400 mb-6">This survey may have been removed or is no longer active.</p>
          <Button onClick={() => navigate('/')} variant="ghost" className="text-cyan-400">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen bg-[#0A0814] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center">
          <div className="rounded-2xl border border-green-500/30 bg-slate-950/80 p-8 shadow-[0_0_40px_rgba(34,197,94,0.1)]">
            <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Response Submitted!</h2>
            <p className="text-slate-400 mb-6">
              Thank you for your feedback. Your response has been recorded and will help improve Mai Troll.
            </p>
            <Button onClick={() => navigate('/')} className="w-full bg-green-600 hover:bg-green-500">
              Return Home
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const questions: SurveyQuestion[] = survey.questions || [
    { id: 'changes', label: 'What needs to be changed?', type: 'textarea', required: false },
    { id: 'issues', label: 'Any issues you are experiencing?', type: 'textarea', required: false },
    { id: 'tips', label: 'What would you like to see next?', type: 'textarea', required: false },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0A0814] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-60">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.12),transparent_40%),radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.1),transparent_40%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-3 py-4 sm:px-4 md:px-8 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full min-w-0"
        >
          <button
            onClick={() => navigate(-1)}
            className="mb-6 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950/80 shadow-[0_0_40px_rgba(34,211,238,0.08)]">
            <div className="border-b border-cyan-500/20 bg-gradient-to-r from-cyan-600/20 via-purple-600/20 to-pink-600/20 p-4 sm:p-6">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 shadow-lg">
                  <ClipboardList className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="break-words text-xl font-black tracking-tight sm:text-2xl">{survey.title}</h1>
                  {survey.description && (
                    <p className="mt-1 break-words text-sm text-slate-400">{survey.description}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-cyan-300">
                Your feedback helps us improve Mai Troll. All responses are anonymous to other users.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="max-h-[calc(100vh-320px)] space-y-6 overflow-y-auto p-4 sm:p-6">
              {questions.map((question, index) => (
                <motion.div
                  key={question.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-2"
                >
                  <label className="block text-sm font-semibold text-slate-200">
                    {question.label}
                    {question.required && <span className="ml-1 text-red-400">*</span>}
                  </label>
                  <Textarea
                    value={answers[question.id] || ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                    placeholder="Type your response..."
                    rows={3}
                    className="max-h-[120px] resize-none border-cyan-500/20 bg-slate-900/60 text-white placeholder:text-slate-500 focus:border-cyan-500/50"
                  />
                </motion.div>
              ))}

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 py-3 font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-purple-500"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Feedback
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
