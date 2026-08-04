import { readFileSync } from 'fs'
import { join } from 'path'

describe('celeb-paid-chat edge function', () => {
  const functionPath = join(__dirname, '..', 'index.ts')
  let source: string

  beforeAll(() => {
    source = readFileSync(functionPath, 'utf-8')
  })

  it('verifies stream is a celeb_stream', () => {
    expect(source).toMatch(/celeb_stream/)
  })

  it('verifies user is a viewer of the stream', () => {
    expect(source).toMatch(/stream_viewers/)
  })

  it('validates price server-side', () => {
    expect(source).toMatch(/Math\.max/)
    expect(source).toMatch(/Math\.min/)
  })

  it('checks paid chat settings before charging', () => {
    expect(source).toMatch(/celeb_paid_chat_settings/)
  })

  it('checks whitelist before charging', () => {
    expect(source).toMatch(/whitelist/)
  })

  it('checks coin_balance before charging', () => {
    expect(source).toMatch(/coin_balance/)
  })

  it('returns insufficient coins error', () => {
    expect(source).toMatch(/Insufficient coins/)
  })

  it('records coin transaction for the charge', () => {
    expect(source).toMatch(/coin_transactions/)
  })

  it('inserts into celeb_paid_chat_messages table', () => {
    expect(source).toMatch(/from\(["']celeb_paid_chat_messages["']\)/)
  })

  it('rejects non-viewers', () => {
    expect(source).toMatch(/You must be a viewer to send paid chat/)
  })
})
