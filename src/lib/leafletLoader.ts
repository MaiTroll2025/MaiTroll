let leafletCache: typeof import('leaflet') | null = null
let reactLeafletCache: typeof import('react-leaflet') | null = null

export async function loadLeaflet() {
  if (leafletCache && reactLeafletCache) return { L: leafletCache, RL: reactLeafletCache }
  const [L, RL, _css] = await Promise.all([
    import('leaflet'),
    import('react-leaflet'),
    import('leaflet/dist/leaflet.css?inline'),
  ])
  leafletCache = L
  reactLeafletCache = RL
  return { L, RL }
}
