import { useState, type MouseEvent } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import ReportModal from '@/components/ReportModal'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

interface ChatMessageReportButtonProps {
  username: string
  content: string
  streamId: string | null
  className?: string
}

export default function ChatMessageReportButton({
  username,
  content,
  streamId,
  className,
}: ChatMessageReportButtonProps) {
  const { user } = useAuthStore()
  const [targetUserId, setTargetUserId] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)

  if (!user || !username) return null

  const handleReport = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (isResolving) return

    setIsResolving(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()

      if (error) throw error
      if (!data?.id) {
        toast.error('Could not find this chat user to report')
        return
      }
      if (data.id === user.id) {
        toast.info('You cannot report your own message')
        return
      }

      setTargetUserId(data.id)
    } catch (error) {
      console.error('[ChatMessageReportButton] Failed to resolve chat user:', error)
      toast.error('Could not open a report for this chat user')
    } finally {
      setIsResolving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleReport}
        disabled={isResolving}
        aria-label={`Report ${username}`}
        title={`Report ${username}`}
        className={className || 'inline-flex items-center rounded p-1 text-white/45 transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50'}
      >
        <AlertTriangle className="h-3 w-3" />
      </button>
      {targetUserId && (
        <ReportModal
          isOpen
          onClose={() => setTargetUserId(null)}
          targetUserId={targetUserId}
          streamId={streamId}
          targetType="user"
          initialDescription={`Chat message: ${content}`}
          onSuccess={() => setTargetUserId(null)}
        />
      )}
    </>
  )
}
