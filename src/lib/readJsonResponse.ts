export async function readJsonResponse<T extends { error?: string }>(response: Response): Promise<T> {
  const body = await response.text()
  if (!body.trim()) {
    throw new Error(`The server returned an empty response (HTTP ${response.status}). Please retry.`)
  }

  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    const message = response.ok
      ? 'The server returned an invalid response. Please retry.'
      : `The request failed (HTTP ${response.status}) and the server returned an invalid response.`
    throw new Error(message)
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The server returned an unexpected response. Please retry.')
  }

  return payload as T
}
