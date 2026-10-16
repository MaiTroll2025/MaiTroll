import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).send('Method not allowed')
  }

  const key = process.env.INDEXNOW_KEY
  if (!key || req.query.key !== key) return res.status(404).send('Not found')
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  if (req.method === 'HEAD') return res.status(200).end()
  return res.status(200).send(key)
}
