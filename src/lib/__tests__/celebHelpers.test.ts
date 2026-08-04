import { isCelebApproved, isCelebPending } from '../staff'

describe('isCelebApproved', () => {
  it('returns false for null profile', () => {
    expect(isCelebApproved(null)).toBe(false)
  })

  it('returns false for undefined profile', () => {
    expect(isCelebApproved(undefined)).toBe(false)
  })

  it('returns false when celeb_role is undefined', () => {
    expect(isCelebApproved({ role: 'user' })).toBe(false)
  })

  it('returns false when celeb_role is null', () => {
    expect(isCelebApproved({ role: 'user', celeb_role: null })).toBe(false)
  })

  it('returns false when celeb_role is pending', () => {
    expect(isCelebApproved({ role: 'user', celeb_role: 'pending' })).toBe(false)
  })

  it('returns false when celeb_role is denied', () => {
    expect(isCelebApproved({ role: 'user', celeb_role: 'denied' })).toBe(false)
  })

  it('returns true when celeb_role is approved', () => {
    expect(isCelebApproved({ role: 'user', celeb_role: 'approved' })).toBe(true)
  })

  it('returns true for admin with celeb_role approved', () => {
    expect(isCelebApproved({ role: 'admin', celeb_role: 'approved' })).toBe(true)
  })
})

describe('isCelebPending', () => {
  it('returns false for null profile', () => {
    expect(isCelebPending(null)).toBe(false)
  })

  it('returns false when celeb_role is undefined', () => {
    expect(isCelebPending({ role: 'user' })).toBe(false)
  })

  it('returns false when celeb_role is approved', () => {
    expect(isCelebPending({ role: 'user', celeb_role: 'approved' })).toBe(false)
  })

  it('returns true when celeb_role is pending', () => {
    expect(isCelebPending({ role: 'user', celeb_role: 'pending' })).toBe(true)
  })

  it('returns false when celeb_role is denied', () => {
    expect(isCelebPending({ role: 'user', celeb_role: 'denied' })).toBe(false)
  })
})
