import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Award,
  BookOpen,
  ChevronRight,
  Coins,
  GraduationCap,
  LayoutDashboard,
  PlusCircle,
  School,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import { neonCard, neonTextGradient } from '../phoneTheme'

type AcademyTab = {
  id: string
  label: string
  description: string
  icon: React.ElementType
  path: string
  teacherOnly?: boolean
}

function normalizeRole(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

export default function PhoneAcademy() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  /*
   * ------------------------------------------------------------
   * ROLE DETECTION
   * ------------------------------------------------------------
   *
   * We intentionally check several common profile locations so
   * this phone page remains compatible with the existing auth
   * profile structure.
   */
  const isTeacher = useMemo(() => {
    const possibleRoles = [
      profile?.role,
      profile?.user_role,
      profile?.account_type,
      profile?.type,
      user?.user_metadata?.role,
      user?.user_metadata?.user_role,
      user?.user_metadata?.account_type,
    ]

    return possibleRoles.some((role) => {
      const normalized = normalizeRole(role)

      return [
        'teacher',
        'academyteacher',
        'instructor',
        'educator',
      ].includes(normalized)
    })
  }, [profile, user])

  const isAdmin = useMemo(() => {
    const possibleRoles = [
      profile?.role,
      profile?.user_role,
      user?.user_metadata?.role,
      user?.user_metadata?.user_role,
    ]

    return possibleRoles.some((role) => {
      const normalized = normalizeRole(role)

      return [
        'admin',
        'administrator',
        'superadmin',
        'academyadmin',
      ].includes(normalized)
    })
  }, [profile, user])

  /*
   * ------------------------------------------------------------
   * ACADEMY NAVIGATION
   * ------------------------------------------------------------
   *
   * Regular users get the normal student experience.
   *
   * Teachers get the student experience PLUS all teacher tools.
   *
   * Admins receive teacher tools as well because Academy
   * administration needs access to the management areas.
   */
  const tabs = useMemo<AcademyTab[]>(() => {
    const regularTabs: AcademyTab[] = [
      {
        id: 'home',
        label: 'Academy Home',
        description: 'Your Academy dashboard and activity',
        icon: LayoutDashboard,
        path: '/academy',
      },
      {
        id: 'courses',
        label: 'Courses',
        description: 'Browse available Academy courses',
        icon: BookOpen,
        path: '/academy/courses',
      },
      {
        id: 'learning',
        label: 'My Learning',
        description: 'Continue the courses you are taking',
        icon: GraduationCap,
        path: '/academy/learning',
      },
      {
        id: 'certificates',
        label: 'Certificates',
        description: 'View your earned Academy certificates',
        icon: Award,
        path: '/academy/certificates',
      },
      {
        id: 'rewards',
        label: 'Coin Rewards',
        description: 'See your Academy Troll Coin rewards',
        icon: Coins,
        path: '/academy/rewards',
      },
    ]

    const teacherTabs: AcademyTab[] = [
      {
        id: 'teacher-dashboard',
        label: 'Teacher Dashboard',
        description: 'Manage your Academy teaching activity',
        icon: School,
        path: '/academy/teacher',
        teacherOnly: true,
      },
      {
        id: 'my-courses',
        label: 'My Courses',
        description: 'Manage courses you teach',
        icon: BookOpen,
        path: '/academy/teacher/courses',
        teacherOnly: true,
      },
      {
        id: 'create-course',
        label: 'Create Course',
        description: 'Create and publish a new course',
        icon: PlusCircle,
        path: '/academy/teacher/courses/create',
        teacherOnly: true,
      },
      {
        id: 'students',
        label: 'My Students',
        description: 'View and manage your students',
        icon: Users,
        path: '/academy/teacher/students',
        teacherOnly: true,
      },
      {
        id: 'teacher-rewards',
        label: 'Teacher Rewards',
        description: 'View your teaching rewards and earnings',
        icon: Coins,
        path: '/academy/teacher/rewards',
        teacherOnly: true,
      },
      {
        id: 'teacher-settings',
        label: 'Teacher Settings',
        description: 'Manage your Academy teaching profile',
        icon: Settings,
        path: '/academy/teacher/settings',
        teacherOnly: true,
      },
    ]

    const adminTabs: AcademyTab[] = [
      {
        id: 'academy-management',
        label: 'Academy Management',
        description: 'Manage the Academy platform',
        icon: ShieldCheck,
        path: '/academy/admin',
        teacherOnly: true,
      },
    ]

    return [
      ...regularTabs,
      ...(isTeacher || isAdmin ? teacherTabs : []),
      ...(isAdmin ? adminTabs : []),
    ]
  }, [isTeacher, isAdmin])

  const openTab = (tab: AcademyTab) => {
    navigate(tab.path)
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#05010f] text-white">
      {/* ======================================================
          HEADER
      ====================================================== */}
      <header className="sticky top-0 z-40 border-b border-[#00BFFF]/20 bg-[#05010f]/90 px-4 py-3 backdrop-blur-2xl">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex flex-col items-center">
            <div className={`text-sm font-black uppercase tracking-[0.2em] ${neonTextGradient}`}>
              Academy
            </div>

            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              MaiTroll
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate('/academy')}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#8b5cf6]/20 bg-[#8b5cf6]/10 text-purple-300 transition active:scale-95"
            aria-label="Academy home"
          >
            <Sparkles size={17} />
          </button>
        </div>
      </header>

      <main className="space-y-4 p-4 pb-24">
        {/* ====================================================
            HERO
        ==================================================== */}
        <section
          className={`${neonCard} relative overflow-hidden p-5`}
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#00BFFF]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-[#8b5cf6]/10 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#00BFFF]/30 bg-gradient-to-br from-[#00BFFF]/20 to-[#8b5cf6]/20 shadow-[0_0_25px_rgba(0,191,255,0.15)]">
                <GraduationCap className="h-6 w-6 text-[#00BFFF]" />
              </div>

              <div className="min-w-0">
                <h1 className="text-lg font-black text-white">
                  MaiTroll Academy
                </h1>

                <p className="mt-0.5 text-[11px] text-zinc-400">
                  Learn. Teach. Earn. Grow.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="rounded-full border border-[#00BFFF]/20 bg-[#00BFFF]/10 px-3 py-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-[#00BFFF]">
                  {isTeacher || isAdmin ? 'Teacher Access' : 'Student Access'}
                </span>
              </div>

              {isAdmin && (
                <div className="rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1">
                  <span className="text-[9px] font-black uppercase tracking-wider text-purple-300">
                    Admin
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ====================================================
            ACADEMY MENU
        ==================================================== */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-black text-white">
                Academy
              </h2>

              <p className="mt-0.5 text-[10px] text-zinc-500">
                {isTeacher || isAdmin
                  ? 'Your student and teacher tools'
                  : 'Everything you need to learn'}
              </p>
            </div>

            <span className="text-[9px] font-bold text-zinc-600">
              {tabs.length} SECTIONS
            </span>
          </div>

          <div className="space-y-2">
            {tabs.map((tab, index) => {
              const Icon = tab.icon

              const isTeacherSection = Boolean(tab.teacherOnly)

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => openTab(tab)}
                  className={[
                    'group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl',
                    'border border-white/10 bg-white/[0.035] p-3.5 text-left',
                    'transition-all duration-200 active:scale-[0.985]',
                    'hover:border-[#00BFFF]/30 hover:bg-white/[0.06]',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'absolute inset-y-0 left-0 w-[2px]',
                      isTeacherSection
                        ? 'bg-gradient-to-b from-purple-400 to-fuchsia-500'
                        : 'bg-gradient-to-b from-[#00BFFF] to-[#8b5cf6]',
                    ].join(' ')}
                  />

                  <div
                    className={[
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                      'border',
                      isTeacherSection
                        ? 'border-purple-400/20 bg-purple-500/10'
                        : 'border-[#00BFFF]/20 bg-[#00BFFF]/10',
                    ].join(' ')}
                  >
                    <Icon
                      size={20}
                      className={
                        isTeacherSection
                          ? 'text-purple-300'
                          : 'text-[#00BFFF]'
                      }
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-black text-white">
                        {tab.label}
                      </p>

                      {isTeacherSection && (
                        <span className="shrink-0 rounded-full border border-purple-400/20 bg-purple-500/10 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-purple-300">
                          Teacher
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                      {tab.description}
                    </p>
                  </div>

                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.03] text-zinc-600 transition group-hover:text-[#00BFFF]">
                    <ChevronRight size={16} />
                  </div>

                  {index === 0 && (
                    <div className="pointer-events-none absolute right-14 top-2 h-1 w-1 rounded-full bg-[#00BFFF] shadow-[0_0_10px_#00BFFF]" />
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* ====================================================
            TEACHER AREA
        ==================================================== */}
        {(isTeacher || isAdmin) && (
          <section
            className={`${neonCard} overflow-hidden p-4`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20">
                <Video className="h-5 w-5 text-purple-300" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-white">
                  Teacher Tools Enabled
                </p>

                <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">
                  You have access to the Academy teaching dashboard,
                  courses, students, rewards, and teaching settings.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ====================================================
            STUDENT CTA
        ==================================================== */}
        {!isTeacher && !isAdmin && (
          <section className="rounded-2xl border border-[#00BFFF]/10 bg-gradient-to-r from-[#00BFFF]/5 to-[#8b5cf6]/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00BFFF]/10">
                <Sparkles className="h-4 w-4 text-[#00BFFF]" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black text-white">
                  Ready to learn?
                </p>

                <p className="mt-0.5 text-[10px] text-zinc-500">
                  Browse Academy courses and start earning Troll Coins.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}