import React from 'react';

let rechartsCache: typeof import('recharts') | null = null

async function loadRecharts() {
  if (rechartsCache) return rechartsCache
  rechartsCache = await import('recharts')
  return rechartsCache
}

function RechartsLoader({ children }: { children: (recharts: typeof import('recharts')) => React.ReactNode }) {
  const [recharts, setRecharts] = React.useState<typeof import('recharts') | null>(null)

  React.useEffect(() => {
    loadRecharts().then(setRecharts)
  }, [])

  if (!recharts) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-400 bg-slate-900/30 rounded-xl border border-slate-700/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          <span className="text-sm">Loading charts...</span>
        </div>
      </div>
    )
  }

  return <>{children(recharts)}</>
}

export function LazyLineChart({
  data,
  dataKey,
  xAxisKey,
  stroke,
  name,
  height = 300,
  children
}: {
  data: any[]
  dataKey: string
  xAxisKey: string
  stroke: string
  name: string
  height?: number
  children?: (recharts: typeof import('recharts')) => React.ReactNode
}) {
  return (
    <RechartsLoader>
      {(R) => (
        <div style={{ width: '100%', height }}>
          <R.ResponsiveContainer>
            <R.LineChart data={data}>
              <R.CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <R.XAxis dataKey={xAxisKey} tick={{ fontSize: 12 }} stroke="#64748b" />
              <R.YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
              <R.Tooltip />
              <R.Legend />
              <R.Line type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={2} dot={{ r: 3 }} name={name} />
              {children?.(R)}
            </R.LineChart>
          </R.ResponsiveContainer>
        </div>
      )}
    </RechartsLoader>
  )
}

export function LazyBarChart({
  children
}: {
  children: (recharts: typeof import('recharts')) => React.ReactNode
}) {
  return (
    <RechartsLoader>
      {(R) => <>{children(R)}</>}
    </RechartsLoader>
  )
}

export function LazyPieChart({
  children
}: {
  children: (recharts: typeof import('recharts')) => React.ReactNode
}) {
  return (
    <RechartsLoader>
      {(R) => <>{children(R)}</>}
    </RechartsLoader>
  )
}

export { RechartsLoader }
