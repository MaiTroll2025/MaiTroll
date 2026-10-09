import { useEffect, useState } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { Profile } from '../types/database'
import { supabase } from '../lib/supabase'
import { AuthContext } from '../hooks/useVerificationAuth'

export interface SignUpPayload {
  email: string
  password: string
  username: string
  firstName: string
  lastName: string
  dateOfBirth: string
  country: string
  idFront: File
  idBack: File
  selfie: File
}

export interface AuthContextType {
  user: Profile | null
  loading: boolean
  signUp: (payload: SignUpPayload) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

async function uploadVerificationFile(userId: string, prefix: string, file: File) {
  const extension = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/${prefix}.${extension}`
  const { error } = await supabase.storage
    .from('user-verification')
    .upload(path, file, { cacheControl: '3600', upsert: true })

  if (error) {
    throw error
  }

  return path
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error(error)
      return null
    }

    return data as Profile
  }

  useEffect(() => {
    const init = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        setUser(profile)
      }
      setLoading(false)
    }

    init()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id)
          setUser(profile)
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe()
      }
    }
  }, [])

  const signUp = async (payload: SignUpPayload) => {
    const { email, password, username, firstName, lastName, dateOfBirth, country, idFront, idBack, selfie } = payload

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          first_name: firstName,
          last_name: lastName,
          country,
          date_of_birth: dateOfBirth
        }
      }
    })

    if (error) {
      throw error
    }

    const userId = data.user?.id
    if (!userId) {
      throw new Error('Unable to create account')
    }

    const frontPath = await uploadVerificationFile(userId, 'id-front', idFront)
    const backPath = await uploadVerificationFile(userId, 'id-back', idBack)
    const selfiePath = await uploadVerificationFile(userId, 'selfie', selfie)

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      username,
      email,
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth,
      country,
      verification_status: 'pending',
      verification_front_path: frontPath,
      verification_back_path: backPath,
      verification_selfie_path: selfiePath
    })

    if (profileError) {
      throw profileError
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
