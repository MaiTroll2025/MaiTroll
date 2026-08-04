import { readFileSync } from 'fs'
import { join } from 'path'

describe('submit-celeb-application edge function', () => {
  const functionPath = join(__dirname, '..', 'index.ts')
  let source: string

  beforeAll(() => {
    source = readFileSync(functionPath, 'utf-8')
  })

  it('handles OPTIONS preflight', () => {
    expect(source).toContain('handleCorsPreflight')
  })

  it('only accepts POST method', () => {
    expect(source).toContain('Method not allowed')
  })

  it('requires Authorization header', () => {
    expect(source).toContain('Missing Authorization')
  })

  it('verifies the user is authenticated', () => {
    expect(source).toContain('Unauthorized')
    expect(source).toContain('auth.getUser')
  })

  it('validates required fields (full_name, phone_number)', () => {
    expect(source).toContain('full_name and phone_number are required')
  })

  it('checks for existing pending/in_review application', () => {
    expect(source).toContain('pending')
    expect(source).toContain('in_review')
  })

  it('inserts application into celeb_applications table', () => {
    expect(source).toContain('from("celeb_applications")')
  })

  it('sends notification on submission', () => {
    expect(source).toContain('create_notification')
    expect(source).toContain('celeb_application')
  })

  it('logs audit event', () => {
    expect(source).toContain('celeb_audit_logs')
    expect(source).toContain('application_submitted')
  })

  it('sets status to pending on new applications', () => {
    expect(source).toMatch(/status:\s*["']pending["']/)
  })

  it('resets denied applications to pending on resubmit', () => {
    expect(source).toMatch(/denied.*pending/)
  })

  it('returns the application_id in the response', () => {
    expect(source).toContain('application_id')
  })
})
