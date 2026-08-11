import type { ElementType } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';

import {
  Tv,
  Hash,
  Users,
  Gavel,
  BarChart3,
  Play,
  Coins,
  Trophy,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

export type SingOffView =
  | 'stage'
  | 'chat'
  | 'queue'
  | 'judges'
  | 'stats';

export type SingOffLobbyView =
  | 'shows'
  | 'coins'
  | 'championship'
  | 'stats'
  | 'judges';

type SidebarView = SingOffView | SingOffLobbyView;

interface SingOffSidebarProps {
  context: 'stage' | 'lobby';
  activeView: SidebarView;

  onChange: (view: SidebarView) => void;

  onBack?: () => void;

  canStartShow?: boolean;

  onStartShow?: () => void;

  isShowLive?: boolean;
}

interface SidebarTab<T extends SidebarView> {
  id: T;
  label: string;
  icon: ElementType;
}

const STAGE_TABS: SidebarTab<SingOffView>[] = [
  {
    id: 'stage',
    label: 'Stage',
    icon: Tv,
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: Hash,
  },
  {
    id: 'queue',
    label: 'Queue',
    icon: Users,
  },
  {
    id: 'judges',
    label: 'Judges',
    icon: Gavel,
  },
  {
    id: 'stats',
    label: 'Stats',
    icon: BarChart3,
  },
];

const LOBBY_TABS: SidebarTab<SingOffLobbyView>[] = [
  {
    id: 'shows',
    label: 'Shows',
    icon: Play,
  },
  {
    id: 'coins',
    label: 'Coins',
    icon: Coins,
  },
  {
    id: 'championship',
    label: 'Championship',
    icon: Trophy,
  },
  {
    id: 'stats',
    label: 'Stats',
    icon: BarChart3,
  },
  {
    id: 'judges',
    label: 'Judges',
    icon: Gavel,
  },
];

export function SingOffSidebar({
  context,
  activeView,
  onChange,
  onBack,
  canStartShow = false,
  onStartShow,
  isShowLive = false,
}: SingOffSidebarProps) {
  const { isMobileWidth } = useIsMobile();

  const tabs =
    context === 'stage'
      ? STAGE_TABS
      : LOBBY_TABS;

  const renderTabs = () => {
    return tabs.map((tab) => {
      const Icon = tab.icon;
      const active = activeView === tab.id;

      return (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          aria-current={active ? 'page' : undefined}
          className={[
            'flex items-center gap-2',
            'rounded-xl',
            'px-3 py-2.5',
            'text-sm font-semibold',
            'transition',
            active
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20'
              : 'text-zinc-300 hover:bg-white/10 hover:text-white',
          ].join(' ')}
        >
          <Icon className="h-4 w-4 shrink-0" />

          <span>{tab.label}</span>
        </button>
      );
    });
  };

  const renderStartShowButton = () => {
    if (
      context !== 'stage' ||
      !canStartShow ||
      !onStartShow ||
      isShowLive
    ) {
      return null;
    }

    return (
      <button
        type="button"
        onClick={onStartShow}
        className="
          mt-2
          flex
          items-center
          gap-2
          rounded-xl
          border
          border-yellow-400/30
          bg-yellow-400/10
          px-3
          py-2.5
          text-sm
          font-bold
          text-yellow-300
          transition
          hover:bg-yellow-400/20
          hover:text-yellow-200
        "
      >
        <Sparkles className="h-4 w-4" />

        Start Show
      </button>
    );
  };

  /**
   * MOBILE
   *
   * Bottom navigation for Mai Sing Off.
   */
  if (isMobileWidth) {
    return (
      <nav
        className="
          fixed
          inset-x-0
          bottom-0
          z-50
          border-t
          border-white/10
          bg-slate-950/95
          px-2
          pb-[max(env(safe-area-inset-bottom),0.5rem)]
          pt-2
          backdrop-blur-xl
        "
        aria-label="Mai Sing Off navigation"
      >
        <div className="flex items-center gap-1 overflow-x-auto">
          {context === 'stage' && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="
                flex
                min-w-[52px]
                shrink-0
                flex-col
                items-center
                justify-center
                gap-1
                rounded-xl
                px-2
                py-2
                text-xs
                font-semibold
                text-zinc-400
                transition
                hover:bg-white/10
                hover:text-white
              "
              aria-label="Back to Mai Sing Off"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}

          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeView === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex',
                  'min-w-[64px]',
                  'shrink-0',
                  'flex-col',
                  'items-center',
                  'justify-center',
                  'gap-1',
                  'rounded-xl',
                  'px-2',
                  'py-2',
                  'text-xs',
                  'font-semibold',
                  'transition',
                  active
                    ? 'bg-pink-600 text-white'
                    : 'text-zinc-400 hover:bg-white/10 hover:text-white',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />

                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  /**
   * DESKTOP
   */
  return (
    <aside
      className="
        fixed
        left-0
        top-0
        z-40
        hidden
        h-screen
        w-56
        flex-col
        border-r
        border-white/10
        bg-slate-950/95
        p-3
        backdrop-blur-xl
        md:flex
      "
    >
      <div className="mb-4">
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/15">
              <Tv className="h-5 w-5 text-pink-400" />
            </div>

            <div>
              <div className="text-sm font-black text-white">
                Mai Sing Off
              </div>

              <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                {context === 'stage'
                  ? 'Live Stage'
                  : 'Competition'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {context === 'stage' && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="
            mb-3
            flex
            items-center
            gap-2
            rounded-xl
            px-3
            py-2.5
            text-sm
            font-semibold
            text-zinc-400
            transition
            hover:bg-white/10
            hover:text-white
          "
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Shows
        </button>
      )}

      <div className="flex flex-col gap-1">
        {renderTabs()}

        {renderStartShowButton()}
      </div>
    </aside>
  );
}