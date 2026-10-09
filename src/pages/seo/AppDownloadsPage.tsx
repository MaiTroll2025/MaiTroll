import SEOLayout, { Breadcrumb } from './SEOLayout'
import { appDownloadReleases } from './appDownloadReleases'
import { CalendarDays, Download, Smartphone } from 'lucide-react'

export default function AppDownloadsPage() {
  return (
    <SEOLayout
      title="App Downloads"
      description="Download official MaiTroll Android APK releases and view version details."
      keywords={['MaiTroll app download', 'MaiTroll Android APK', 'MaiTroll Android app']}
    >
      <Breadcrumb items={[{ label: 'App Downloads' }]} />

      <main className="mx-auto max-w-5xl px-4 py-12">
        <header className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-3">
              <Smartphone className="h-7 w-7 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-purple-400">Official Android releases</p>
              <h1 className="text-4xl font-bold text-white md:text-5xl">App Downloads</h1>
            </div>
          </div>
          <p className="max-w-3xl text-lg leading-relaxed text-slate-300">
            Download the official MaiTroll Android app package (APK). Each release lists its version,
            build number, and publication date.
          </p>
        </header>

        {appDownloadReleases.length > 0 ? (
          <section className="space-y-4" aria-label="Available Android APK releases">
            {appDownloadReleases.map((release) => (
              <article
                key={`${release.version}-${release.build}`}
                className="flex flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h2 className="text-xl font-bold text-white">MaiTroll Android {release.version}</h2>
                  <p className="mt-1 text-sm text-slate-400">Build {release.build}</p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                    <CalendarDays className="h-4 w-4" />
                    Released {release.releaseDate}
                  </p>
                  {release.notes && <p className="mt-3 text-sm text-slate-300">{release.notes}</p>}
                </div>
                <a
                  href={release.apkPath}
                  download
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-500"
                  aria-label={`Download MaiTroll Android version ${release.version} APK`}
                >
                  <Download className="h-5 w-5" />
                  Download APK
                </a>
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
            <Smartphone className="mx-auto mb-4 h-10 w-10 text-slate-500" />
            <h2 className="text-xl font-semibold text-white">No APK releases yet</h2>
            <p className="mt-2 text-slate-400">
              Official Android APK downloads will appear here when the first release is published.
            </p>
          </section>
        )}
      </main>
    </SEOLayout>
  )
}
