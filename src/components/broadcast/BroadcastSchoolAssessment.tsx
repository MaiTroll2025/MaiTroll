import React, { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CardContent } from '@/components/ui/card'
import { CardHeader } from '@/components/ui/card'
import { CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle, X } from 'lucide-react'
import { toast } from 'sonner'

type AnswerMap = Record<string, string>

const QUESTIONS = [
  {
    id: 'q1',
    text: 'A viewer asks you for your real name and address during a broadcast. What should you do?',
    options: [
      { id: 'A', text: 'Share it to build trust with the viewer' },
      { id: 'B', text: 'Decline and remind them not to share personal information' },
      { id: 'C', text: 'Share only your name, not your address' },
      { id: 'D', text: 'Ban them immediately without explanation' },
    ],
  },
  {
    id: 'q2',
    text: 'How often should you acknowledge and engage with viewers in chat during a live broadcast?',
    options: [
      { id: 'A', text: 'Never — focus only on the content' },
      { id: 'B', text: 'Only when a viewer sends a gift' },
      { id: 'C', text: 'Regularly throughout the broadcast to keep chat active' },
      { id: 'D', text: 'Only at the start and end of the stream' },
    ],
  },
  {
    id: 'q3',
    text: 'Which of the following is prohibited content during a broadcast?',
    options: [
      { id: 'A', text: 'Playing licensed music you own' },
      { id: 'B', text: 'Hate speech, harassment, or threats of violence' },
      { id: 'C', text: 'Talking about your day' },
      { id: 'D', text: 'Wearing a hat' },
    ],
  },
  {
    id: 'q4',
    text: 'If a Broadofficer issues you a warning during your stream, what should you do?',
    options: [
      { id: 'A', text: 'Ignore it and keep broadcasting as before' },
      { id: 'B', text: 'Argue with the officer in chat' },
      { id: 'C', text: 'Acknowledge the warning and adjust your behavior' },
      { id: 'D', text: 'End your stream immediately' },
    ],
  },
  {
    id: 'q5',
    text: 'What happens if you receive a Broadcast School referral?',
    options: [
      { id: 'A', text: 'Nothing — you can keep broadcasting normally' },
      { id: 'B', text: 'You are blocked from starting broadcasts until you complete the assessment and pass review' },
      { id: 'C', text: 'Your account is deleted' },
      { id: 'D', text: 'You are permanently banned' },
    ],
  },
  {
    id: 'q6',
    text: 'How many questions are on the Broadcast School assessment, and what is the passing score?',
    options: [
      { id: 'A', text: '5 questions, 50% to pass' },
      { id: 'B', text: '10 questions, 70% to pass' },
      { id: 'C', text: '20 questions, 90% to pass' },
      { id: 'D', text: '10 questions, 100% to pass' },
    ],
  },
  {
    id: 'q7',
    text: 'If you fail the Broadcast School assessment, what happens?',
    options: [
      { id: 'A', text: 'You can never broadcast again' },
      { id: 'B', text: 'You enter a cooldown period and may retry after it expires' },
      { id: 'C', text: 'You are automatically banned' },
      { id: 'D', text: 'You must pay a fine' },
    ],
  },
  {
    id: 'q8',
    text: 'Who reviews your Broadcast School assessment after you submit it?',
    options: [
      { id: 'A', text: 'An automated bot only' },
      { id: 'B', text: 'No one reviews it' },
      { id: 'C', text: 'Platform staff / moderation team' },
      { id: 'D', text: 'Other viewers' },
    ],
  },
  {
    id: 'q9',
    text: 'Can staff members bypass Broadcast School restrictions?',
    options: [
      { id: 'A', text: 'Yes, staff have 24/7 bypass access' },
      { id: 'B', text: 'No, everyone must complete Broadcast School' },
      { id: 'C', text: 'Only admins can bypass' },
      { id: 'D', text: 'Only during operating hours' },
    ],
  },
  {
    id: 'q10',
    text: 'What should you do if you are unsure whether content is allowed on stream?',
    options: [
      { id: 'A', text: 'Broadcast it anyway and see what happens' },
      { id: 'B', text: 'Do not broadcast it; contact support or staff for guidance' },
      { id: 'C', text: 'Broadcast it briefly, then remove it' },
      { id: 'D', text: 'Ask viewers to vote on it' },
    ],
  },
] as const

interface BroadcastSchoolAssessmentProps {
  _referralId?: string | null
  onComplete: (result: { score: number; passed: boolean; attemptId: string | null }) => void
}

export default function BroadcastSchoolAssessment({
  _referralId,
  onComplete,
}: BroadcastSchoolAssessmentProps) {
  const { user } = useAuthStore()
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [timeLeft, setTimeLeft] = useState(600)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; passed: boolean; attemptId: string | null } | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isLastQuestion = currentQuestion === QUESTIONS.length - 1

  useEffect(() => {
    if (submitted) return
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setSubmitted(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [submitted])

  const handleAnswer = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }))
  }

  const nextQuestion = () => {
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const handleSubmit = useCallback(async () => {
    if (!user?.id) {
      toast.error('You must be signed in to complete the assessment.')
      return
    }
    setSubmitting(true)
    try {
      const timeSpent = 600 - timeLeft
      const { data, error } = await supabase.rpc('submit_broadcast_school_assessment', {
        p_user_id: user.id,
        p_answers: answers,
        p_time_spent_seconds: timeSpent,
      })

      if (error) {
        console.error('[BroadcastSchoolAssessment] RPC error:', error)
        toast.error(error?.message || 'Failed to submit assessment.')
        setSubmitting(false)
        return
      }

      if (!data?.success) {
        toast.error(data?.message || 'Failed to submit assessment.')
        setSubmitting(false)
        return
      }

      const score = data.data?.score ?? 0
      const passed = Boolean(data.data?.passed)
      const attemptId = data.data?.attempt_id ?? null

      setResult({ score, passed, attemptId })
      setSubmitted(true)
      onComplete({ score, passed, attemptId })
    } catch (err) {
      console.error('[BroadcastSchoolAssessment] Exception:', err)
      toast.error('An unexpected error occurred.')
      setSubmitting(false)
    }
  }, [user?.id, answers, timeLeft, onComplete])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

  if (submitted && result) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-slate-950">
        <Card className="w-full max-w-md rounded-3xl border border-slate-700/50 p-6 shadow-2xl">
          <div className="flex items-center justify-center space-x-3 mb-4">
            {result.passed ? (
              <CheckCircle size={48} className="text-green-400" />
            ) : (
              <AlertCircle size={48} className="text-amber-400" />
            )}
            <h2 className="text-2xl font-bold text-white">
              {result.passed ? 'Assessment Complete' : 'Assessment Submitted'}
            </h2>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between text-lg">
              <span className="text-slate-400">Score</span>
              <span className="font-bold text-white">{result.score} / 100</span>
            </div>
            <div className="flex items-center justify-between text-lg">
              <span className="text-slate-400">Passing Score</span>
              <span className="font-bold text-green-400">70 / 100</span>
            </div>
            <div className="flex items-center justify-between text-lg">
              <span className="text-slate-400">Result</span>
              <span className={`font-bold ${result.passed ? 'text-green-400' : 'text-amber-400'}`}>
                {result.passed ? 'PASSED' : 'FAILED'}
              </span>
            </div>
          </div>

          {result.passed ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
              <p className="text-sm text-green-300">
                Your assessment has been submitted and passed. It is now pending staff review.
                You will be notified when a moderator reviews your result. You cannot start a broadcast
                until your review is approved.
              </p>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
              <p className="text-sm text-amber-300">
                You did not pass the assessment. You may retry after your cooldown period expires.
                Please review the broadcast guidelines before attempting again.
              </p>
            </div>
          )}

          <Button onClick={() => {}} className="w-full bg-slate-700 text-white py-3" disabled>
            Done
          </Button>
        </Card>
      </div>
    )
  }

  const question = QUESTIONS[currentQuestion]
  const progress = ((currentQuestion + 1) / QUESTIONS.length) * 100

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-slate-950">
      <Card className="w-full max-w-2xl rounded-3xl border border-slate-700/50 p-6 shadow-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="font-bold text-white">Broadcast School Assessment</CardTitle>
            <span className="text-xs font-mono text-slate-400">
              {currentQuestion + 1} / {QUESTIONS.length}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-4">
            <div
              className="bg-amber-500 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Time Remaining</span>
            <span className={`font-mono ${timeLeft < 60 ? 'text-red-400 font-bold' : ''}`}>
              {timeFormatted}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="text-lg font-semibold text-white mb-6">
            {question.text}
          </div>

          <div className="space-y-3">
            {question.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleAnswer(question.id, opt.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors text-sm ${
                  answers[question.id] === opt.id
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="font-bold text-slate-400 mr-2">{opt.id}.</span>
                {opt.text}
              </button>
            ))}
          </div>
        </CardContent>

        <div className="flex items-center justify-between pt-6">
          {currentQuestion > 0 && (
            <Button variant="outline" onClick={prevQuestion} className="text-slate-400 hover:text-white">
              <X size={16} className="mr-2" /> Previous
            </Button>
          )}
          <span className="text-xs text-slate-500">
            {answers[question.id] ? 'Answered' : 'Not answered'}
          </span>
          <Button
            onClick={isLastQuestion ? handleSubmit : nextQuestion}
            disabled={submitting || (!answers[question.id] && isLastQuestion)}
            className="bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold px-6 py-2.5"
          >
            {submitting ? 'Submitting...' : isLastQuestion ? 'Submit Assessment' : 'Next'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
