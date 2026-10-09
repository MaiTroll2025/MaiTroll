import React, { useState } from 'react'
import { Grid3x3 } from 'lucide-react';

export function DevGridOverlay() {
  const [showGrid, setShowGrid] = useState(false)

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  const columns = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  const rows = Array.from({ length: 30 }, (_, i) => i + 1)

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setShowGrid(!showGrid)}
        className="fixed top-4 left-4 z-[999] flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-black text-white shadow-lg hover:bg-cyan-700 transition"
      >
        <Grid3x3 className="h-4 w-4" />
        {showGrid ? 'Hide' : 'Show'} Grid
      </button>

      {/* Grid Overlay */}
      {showGrid && (
        <div className="fixed inset-0 z-[990] pointer-events-none overflow-hidden">
          {/* Column Labels (A-Z) */}
          <div className="fixed top-0 left-0 right-0 h-8 z-[991] flex bg-black/50 backdrop-blur">
            {columns.map((col, _i) => (
              <div
                key={`col-${col}`}
                className="flex-1 flex items-center justify-center text-[10px] font-black text-cyan-300 border-r border-cyan-500/30"
                style={{ width: `${(1 / columns.length) * 100}%` }}
              >
                {col}
              </div>
            ))}
          </div>

          {/* Row Labels (1-30) */}
          <div className="fixed top-8 left-0 w-8 bottom-0 z-[991] flex flex-col bg-black/50 backdrop-blur">
            {rows.map((row) => (
              <div
                key={`row-${row}`}
                className="flex-1 flex items-center justify-center text-[10px] font-black text-cyan-300 border-b border-cyan-500/30"
              >
                {row}
              </div>
            ))}
          </div>

          {/* Grid Lines */}
          <svg
            className="fixed inset-0 w-full h-full"
            style={{ top: '32px', left: '32px', width: 'calc(100% - 32px)', height: 'calc(100% - 32px)' }}
          >
            {/* Vertical Lines */}
            {columns.map((col, i) => (
              <line
                key={`vline-${col}`}
                x1={`${(i / columns.length) * 100}%`}
                y1="0"
                x2={`${(i / columns.length) * 100}%`}
                y2="100%"
                stroke="rgb(34, 211, 238)"
                strokeWidth="1"
                opacity="0.2"
              />
            ))}

            {/* Horizontal Lines */}
            {rows.map((row) => (
              <line
                key={`hline-${row}`}
                x1="0"
                y1={`${((row - 1) / rows.length) * 100}%`}
                x2="100%"
                y2={`${((row - 1) / rows.length) * 100}%`}
                stroke="rgb(34, 211, 238)"
                strokeWidth="1"
                opacity="0.2"
              />
            ))}
          </svg>

          {/* Position Indicator */}
          <div
            className="fixed top-4 right-4 z-[992] bg-black/80 backdrop-blur border border-cyan-400/50 rounded-lg p-2 text-xs font-mono text-cyan-300"
            onMouseMove={(e) => {
              const grid = e.currentTarget
              const _rect = grid.getBoundingClientRect()
              const x = Math.floor((e.clientX / window.innerWidth) * columns.length)
              const y = Math.floor(((e.clientY - 32) / window.innerHeight) * rows.length)
              
              const col = columns[Math.max(0, Math.min(x, columns.length - 1))] || 'A'
              const row = Math.max(1, Math.min(y + 1, rows.length))
              
              grid.textContent = `Position: ${col}${row}`
            }}
          >
            Position: --
          </div>

          {/* Info Box */}
          <div className="fixed bottom-4 left-4 z-[992] bg-black/80 backdrop-blur border border-cyan-400/50 rounded-lg p-3 text-xs font-mono text-cyan-300 max-w-xs">
            <p className="font-black text-cyan-400 mb-1">Dev Grid Mode</p>
            <p>Move your mouse over the grid to see coordinates</p>
            <p className="mt-2 text-cyan-400">Columns: A-Z (26 total)</p>
            <p>Rows: 1-30</p>
          </div>
        </div>
      )}
    </>
  )
}
