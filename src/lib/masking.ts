import { isMarketingAgent } from './supabase'
import { useAuthStore } from './store'

export function maskEmail(email: string | null | undefined): string {
  if (!email) return ''
  
  const profile = useAuthStore.getState().profile
  if (!isMarketingAgent(profile)) return email
  
  const [local, domain] = email.split('@')
  if (!domain) return email
  
  if (local.length <= 2) return '***@' + domain
  return local.substring(0, 2) + '***@' + domain
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  
  const profile = useAuthStore.getState().profile
  if (!isMarketingAgent(profile)) return phone
  
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '***'
  return '***-***-' + digits.substring(digits.length - 4)
}

export function maskCreditCard(cardNumber: string | null | undefined): string {
  if (!cardNumber) return ''
  
  const profile = useAuthStore.getState().profile
  if (!isMarketingAgent(profile)) return cardNumber
  
  const digits = cardNumber.replace(/\D/g, '')
  if (digits.length < 4) return '****'
  return '**** **** **** ' + digits.substring(digits.length - 4)
}

export function maskSSN(ssn: string | null | undefined): string {
  if (!ssn) return ''
  
  const profile = useAuthStore.getState().profile
  if (!isMarketingAgent(profile)) return ssn
  
  const digits = ssn.replace(/\D/g, '')
  if (digits.length < 4) return '***-**'
  return '***-**' + digits.substring(digits.length - 4)
}

export function maskAddress(address: string | null | undefined): string {
  if (!address) return ''
  
  const profile = useAuthStore.getState().profile
  if (!isMarketingAgent(profile)) return address
  
  const parts = address.split(',')
  if (parts.length >= 2) {
    return parts[0] + ', ***'
  }
  return address.substring(0, Math.min(10, address.length)) + '...'
}

export function maskName(name: string | null | undefined): string {
  if (!name) return ''
  
  const profile = useAuthStore.getState().profile
  if (!isMarketingAgent(profile)) return name
  
  const parts = name.split(' ')
  if (parts.length === 1) {
    return name.charAt(0) + '*'.repeat(Math.max(0, name.length - 1))
  }
  return parts.map((part, i) => i === 0 ? part.charAt(0) + '*'.repeat(Math.max(0, part.length - 1)) : '').join(' ').trim()
}

export function maskUsername(username: string | null | undefined): string {
  if (!username) return ''
  
  const profile = useAuthStore.getState().profile
  if (!isMarketingAgent(profile)) return username
  
  if (username.length <= 3) return '*'.repeat(username.length)
  return username.substring(0, 2) + '*'.repeat(username.length - 2)
}

export function maskAmount(amount: number | null | undefined, showPartial = false): string {
  if (amount === null || amount === undefined) return ''
  
  const profile = useAuthStore.getState().profile
  if (!isMarketingAgent(profile) || showPartial) return amount.toString()
  
  return '$***'
}

export function maskBalance(balance: number | null | undefined): string {
  if (balance === null || balance === undefined) return ''
  
  const profile = useAuthStore.getState().profile
  if (!isMarketingAgent(profile)) return balance.toString()
  
  return '********'
}

export function getMaskedUserData<T extends Record<string, unknown>>(user: T): T {
  const profile = useAuthStore.getState().profile
  if (!isMarketingAgent(profile)) return user
  
  return {
    ...user,
    email: maskEmail(user.email as string),
    phone: maskPhone(user.phone as string),
  }
}