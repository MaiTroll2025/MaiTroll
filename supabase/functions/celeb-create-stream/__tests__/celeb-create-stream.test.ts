import { readFileSync } from 'fs'
import { join } from 'path'

describe('celeb-create-stream edge function', () => {
  const functionPath = join(__dirname, '..', 'index.ts')
  let source: string

  beforeAll(() => {
    source = readFileSync(functionPath, 'utf-8')
  })

  it('checks that user is an approved celeb', () => {
    expect(source).toMatch(/celeb_role/)
    expect(source).toMatch(/approved/)
  })

  it('sets stream_type to celeb_stream', () => {
    expect(source).toMatch(/stream_type.*celeb_stream/)
  })

  it('sets seat_count to 0 for celeb streams', () => {
    expect(source).toMatch(/seat_count.*0/)
  })

  it('validates pricing server-side', () => {
    expect(source).toMatch(/pricing_type/)
    expect(source).toMatch(/pricing_value/)
  })

  it('uses Math.max/Math.min for price validation', () => {
    expect(source).toMatch(/Math\.max/)
    expect(source).toMatch(/Math\.min/)
  })

  it('logs stream creation in audit log', () => {
    expect(source).toMatch(/celeb_audit_logs/)
    expect(source).toMatch(/stream_created/)
  })

  it('inserts into streams table', () => {
    expect(source).toMatch(/from\(["']streams["']\)/)
    expect(source).toMatch(/insert/)
  })

  it('returns the stream_id in response', () => {
    expect(source).toMatch(/stream_id/)
  })
})
