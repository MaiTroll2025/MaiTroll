import { cn } from '@/lib/utils'
import { TROCEAN_TILES, type TroceanAttackResult } from '@/lib/trocean'

export default function TroceanGrid({ attacked, selected, ownTile, placementMode = false, disabled = false, onSelect }: {
  attacked: Array<{ tile: string; result: TroceanAttackResult; revealed_username?: string | null }>
  selected?: string | null
  ownTile?: string | null
  placementMode?: boolean
  disabled?: boolean
  onSelect?: (tile: string) => void
}) {
  const attackMap = new Map(attacked.map((item) => [item.tile, item]))
  return (
    <div className="rounded-[28px] border border-cyan-400/20 bg-[radial-gradient(circle_at_center,rgba(8,145,178,.15),transparent_55%),linear-gradient(180deg,#06263c,#020617)] p-3 shadow-[0_0_45px_rgba(34,211,238,.08)]">
      <div className="grid grid-cols-12 gap-1.5">
        {TROCEAN_TILES.map((tile) => {
          const attack = attackMap.get(tile)
          const isSelected = selected === tile
          const isOwn = placementMode && ownTile === tile
          return (
            <button key={tile} type="button" disabled={disabled || Boolean(attack)} onClick={() => onSelect?.(tile)}
              className={cn(
                'group relative aspect-square rounded-md border text-[9px] font-black transition',
                'border-cyan-300/10 bg-cyan-950/45 text-cyan-100/30 hover:border-cyan-300/60 hover:bg-cyan-500/15',
                isSelected && 'border-yellow-300 bg-yellow-400/20 text-yellow-100 shadow-[0_0_18px_rgba(250,204,21,.35)]',
                isOwn && 'border-fuchsia-300 bg-fuchsia-500/20 text-fuchsia-100 shadow-[0_0_18px_rgba(217,70,239,.35)]',
                attack?.result === 'miss' && 'border-sky-300/50 bg-sky-500/20 text-sky-100',
                attack?.result === 'takedown' && 'border-red-300/70 bg-red-500/35 text-white shadow-[0_0_20px_rgba(239,68,68,.45)]',
                attack?.result === 'blocked' && 'border-purple-300/60 bg-purple-500/25 text-purple-100',
                disabled && 'cursor-not-allowed opacity-70',
              )}
              aria-label={`Trocean tile ${tile}`}>
              <span>{tile}</span>
              {attack?.revealed_username && <span className="absolute inset-x-0 -bottom-5 z-20 hidden rounded bg-black/90 px-1 py-0.5 text-[8px] text-white group-hover:block">{attack.revealed_username}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
