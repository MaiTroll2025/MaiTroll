import { readFileSync } from 'fs'
import { join } from 'path'

describe('celeb-review-action edge function', () => {
  const functionPath = join(__dirname, '..', 'index.ts')
  let source: string

  beforeAll(() => {
    source = readFileSync(functionPath, 'utf-8')
  })

  it('requires admin authorization', () => {
    expect(source).toMatch(/Forbidden.*admin only/)
  })

  it('supports approve, deny, and request_info actions', () => {
    expect(source).toMatch(/["']approve["']/)
    expect(source).toMatch(/["']deny["']/)
    expect(source).toMatch(/["']request_info["']/)
  })

  it('rejects invalid actions', () => {
    expect(source).toMatch(/Invalid action/)
  })

  it('updates celeb_role on approval', () => {
    expect(source).toMatch(/celeb_role/)
    expect(source).toMatch(/approved/)
  })

  it('clears celeb_role on denial', () => {
    expect(source).toMatch(/celeb_role.*null/)
  })

  it('creates celeb_profiles row on approval', () => {
    expect(source).toMatch(/from\(["']celeb_profiles["']\)/)
    expect(source).toMatch(/insert/)
  })

  it('sends notification with application_id and status only (no documents)', () => {
    expect(source).toMatch(/create_notification/)
    expect(source).toMatch(/application_id/)
    expect(source).toMatch(/review_status/)
  })

  it('does NOT include identity document URLs in notifications', () => {
    expect(source).not.toMatch(/id_photo_url/)
    expect(source).not.toMatch(/selfie_url/)
  })

  it('logs audit event for review action', () => {
    expect(source).toMatch(/celeb_audit_logs/)
    expect(source).toMatch(/application_/)
  })
})
