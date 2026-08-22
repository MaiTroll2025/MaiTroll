import { useIdleSession } from '../hooks/useIdleSession'

export default function IdleSessionPrompt() {
  const { showIdlePrompt, isBroadcasterVerified, countdown, handleKeepAlive, handleBroadcasterVerify } = useIdleSession()

  if (!showIdlePrompt) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 max-w-md rounded-2xl border border-white/10 bg-[#1a1a2e] p-8 text-center shadow-2xl">
        <h2 className="mb-2 text-2xl font-black text-white">Are you still there?</h2>
        <p className="mb-6 text-sm text-white/70">
          {isBroadcasterVerified
            ? 'Verify you are still broadcasting to keep your stream active.'
            : 'Click below to keep your session active for 30 minutes.'}
        </p>
        {!isBroadcasterVerified && countdown > 0 && (
          <p className="mb-4 text-xs text-red-400">
            Stream will end automatically in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
          </p>
        )}
        <div className="flex flex-col gap-3">
          {isBroadcasterVerified ? (
            <button
              onClick={handleBroadcasterVerify}
              className="rounded-xl bg-green-600 px-6 py-3 font-bold text-white transition hover:bg-green-500"
            >
              Yes, I'm Still Broadcasting
            </button>
          ) : (
            <button
              onClick={handleKeepAlive}
              className="rounded-xl bg-cyan-600 px-6 py-3 font-bold text-white transition hover:bg-cyan-500"
            >
              Yes, Keep Me Logged In
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
