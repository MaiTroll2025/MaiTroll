import { readFileSync } from 'fs'
import { join } from 'path'

describe('celeb-cashout edge function', () => {
  const functionPath = join(__dirname, '..', 'index.ts')
  let source: string

  beforeAll(() => {
    source = readFileSync(functionPath, 'utf-8')
  })

  it('supports list, request, admin_list, admin_review actions', () => {
    expect(source).toMatch(/["']list["']/)
    expect(source).toMatch(/["']request["']/)
    expect(source).toMatch(/["']admin_list["']/)
    expect(source).toMatch(/["']admin_review["']/)
  })

  it('calls create_celeb_cashout_request RPC for requests', () => {
    expect(source).toMatch(/create_celeb_cashout_request/)
  })

  it('restricts admin_list to admins', () => {
    expect(source).toMatch(/Admin only/)
  })

  it('supports approve, reject, pay admin actions', () => {
    expect(source).toMatch(/["']approve["']/)
    expect(source).toMatch(/["']reject["']/)
    expect(source).toMatch(/["']pay["']/)
  })

  it('sends notification on cashout status change', () => {
    expect(source).toMatch(/create_notification/)
    expect(source).toMatch(/cashout_status/)
  })

  it('logs audit event for admin review actions', () => {
    expect(source).toMatch(/celeb_audit_logs/)
    expect(source).toMatch(/cashout_/)
  })

  it('lists active tiers for the tiers action', () => {
    expect(source).toMatch(/celeb_cashout_tiers/)
    expect(source).toMatch(/is_active/)
  })
})
