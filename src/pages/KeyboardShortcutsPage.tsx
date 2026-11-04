import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { getKeyboardShortcuts } from '@/lib/keyboardShortcuts'

export default function KeyboardShortcutsPage() {
  const profile = useAuthStore((state) => state.profile)
  const navigate = useNavigate()
  const shortcuts = getKeyboardShortcuts(profile)

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="mb-2 text-sm uppercase tracking-[0.3em] text-purple-300">MaiTroll</p>
        <h1 className="text-4xl font-bold">Keyboard shortcuts</h1>
        <p className="mt-4 text-slate-300">
          On the homepage, press a shortcut letter to open its destination. Shortcuts are ignored
          while you type in a field. Your role determines which destinations appear here.
        </p>
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.key} className="flex items-center gap-4 border-b border-white/10 px-5 py-4 last:border-b-0">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-lg border border-purple-300/50 bg-purple-950 text-lg font-bold text-purple-100 hover:bg-purple-800"
                aria-label={`Use ${shortcut.key} to ${shortcut.label}`}
                onClick={() => shortcut.phone
                  ? window.dispatchEvent(new CustomEvent('mai-elite-phone-open'))
                  : navigate(shortcut.path || '/')}
              >{shortcut.key}</button>
              <span className="flex-1">{shortcut.label}</span>
              {!shortcut.phone && <Link className="text-sm text-purple-300 hover:text-white" to={shortcut.path || '/'}>Open</Link>}
            </div>
          ))}
        </div>
        <Link className="mt-8 inline-block text-purple-300 hover:text-white" to="/support">Visit Support</Link>
      </div>
    </main>
  )
}
