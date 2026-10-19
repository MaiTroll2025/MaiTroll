import LeagueProgressPanel from '@/components/broadcast/LeagueProgressPanel'

interface LeaguesTabProps {
  streamId?: string | null
  category?: string | null
}

export default function LeaguesTab({ streamId }: LeaguesTabProps) {
  return <LeagueProgressPanel streamId={streamId} />
}
