import { ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'

interface Props {
  children: ReactNode
}

interface CrashDetails {
  kind: string
  message: string
  stack?: string
  componentStack?: string
}

function PhoneCrashScreen({ crash, pathname }: { crash: CrashDetails; pathname: string }) {
  const pageName = pathname.split('/').filter(Boolean).pop() || 'Home'
  const diagnostics = [
    `Type: ${crash.kind}`,
    `Route: ${pathname}`,
    `Message: ${crash.message}`,
    crash.stack ? `Stack:\n${crash.stack}` : '',
    crash.componentStack ? `Component stack:\n${crash.componentStack}` : '',
  ].filter(Boolean).join('\n\n')
  const [copyMessage, setCopyMessage] = useState('')

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnostics)
      setCopyMessage('Diagnostics copied.')
    } catch (error) {
      console.error('[PhoneCrashScreen] Could not copy diagnostics:', error)
      setCopyMessage('Could not copy. Select and copy the details below.')
    }
  }

  return (
    <main className="min-h-screen w-full overflow-y-auto bg-[#07020F] p-4 text-white sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-2xl flex-col justify-center">
        <section className="rounded-2xl border border-red-500/30 bg-slate-900/95 p-5 shadow-2xl sm:p-7">
          <div className="mb-4 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/20">
              <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-red-300">MaiTroll app error</p>
              <h1 className="text-xl font-bold text-white">{crash.kind}</h1>
              <p className="mt-1 break-words font-mono text-sm text-red-300">{crash.message}</p>
            </div>
          </div>

          <p className="mb-4 text-sm text-slate-400">
            An error interrupted the app on <span className="font-semibold text-slate-200">{pageName}</span>.
            Copy these diagnostics and share them with support.
          </p>

          <details className="mb-5 rounded-xl border border-white/10 bg-black/30 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-300">Technical details</summary>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-400">{diagnostics}</pre>
          </details>

          {copyMessage && <p role="status" className="mb-3 text-sm text-slate-300">{copyMessage}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-5 py-3 font-semibold text-black transition hover:from-yellow-400 hover:to-orange-400"
            >
              Reload app
            </button>
            <button
              onClick={() => void copyDiagnostics()}
              className="rounded-xl border border-slate-600 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
            >
              Copy diagnostics
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

export default function PhoneErrorBoundary({ children }: Props) {
  const location = useLocation()
  const [runtimeCrash, setRuntimeCrash] = useState<CrashDetails | null>(null)

  useEffect(() => {
    const handleRuntimeError = (event: ErrorEvent) => {
      const error = event.error instanceof Error ? event.error : undefined
      setRuntimeCrash({
        kind: 'Uncaught JavaScript error',
        message: error?.message || event.message || 'Unknown JavaScript error',
        stack: error?.stack,
      })
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const error = reason instanceof Error ? reason : undefined
      setRuntimeCrash({
        kind: 'Unhandled promise rejection',
        message: error?.message || String(reason || 'Unknown promise rejection'),
        stack: error?.stack,
      })
    }

    window.addEventListener('error', handleRuntimeError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleRuntimeError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return (
    <ErrorBoundary
      onError={(error: Error, info: ErrorInfo) => {
        setRuntimeCrash({
          kind: 'App render error',
          message: error.message || 'Unknown rendering error',
          stack: error.stack,
          componentStack: info.componentStack || undefined,
        })
      }}
      fallback={
        <PhoneCrashScreen
          crash={runtimeCrash || {
            kind: 'App render error',
            message: 'The app could not render this screen. Error details are unavailable.',
          }}
          pathname={location.pathname}
        />
      }
    >
      {runtimeCrash ? (
        <PhoneCrashScreen crash={runtimeCrash} pathname={location.pathname} />
      ) : children}
    </ErrorBoundary>
  )
}
