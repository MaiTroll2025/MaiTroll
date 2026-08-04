import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuthStore } from '../store'
import { deductCoins } from '../coinTransactions'
import type { Vehicle, VehicleLoan, DriverTest, UserLicense } from '../../types/neighborhood'

const LOAN_AMOUNT = 10000
const MONTHLY_PAYMENT = 500
const LICENSE_EXPIRY_DAYS = 30

function generateLicensePlate() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'

  const letter1 = letters[Math.floor(Math.random() * letters.length)]
  const letter2 = letters[Math.floor(Math.random() * letters.length)]
  const letter3 = letters[Math.floor(Math.random() * letters.length)]
  const num1 = numbers[Math.floor(Math.random() * numbers.length)]
  const num2 = numbers[Math.floor(Math.random() * numbers.length)]
  const num3 = numbers[Math.floor(Math.random() * numbers.length)]

  return `${letter1}${letter2}${letter3}${num1}${num2}${num3}`
}

function generateLicenseNumber() {
  return `TC${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 5)
    .toUpperCase()}`
}

function getLicenseExpiry(days = LICENSE_EXPIRY_DAYS) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

export function useVehicleSystem() {
  const { user, profile } = useAuthStore()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [activeVehicle, setActiveVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchVehicles = useCallback(async () => {
    if (!user?.id) {
      setVehicles([])
      setActiveVehicle(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const vehicleRows = data || []
      setVehicles(vehicleRows)

      if (vehicleRows.length > 0) {
        const active =
          vehicleRows.find((vehicle) => vehicle.id === profile?.active_vehicle) ||
          vehicleRows[0]

        setActiveVehicle(active)
      } else {
        setActiveVehicle(null)
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error)
      setVehicles([])
      setActiveVehicle(null)
    } finally {
      setLoading(false)
    }
  }, [user?.id, profile?.active_vehicle])

  useEffect(() => {
    fetchVehicles()
  }, [fetchVehicles])

  const purchaseVehicle = async (
    vehicleName: string,
    make: string,
    model: string,
    year: number,
    price: number,
    withLoan = false
  ) => {
    if (!user?.id) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      let finalPrice = price
      const licensePlate = generateLicensePlate()

      if (withLoan) {
        finalPrice = 0
      }

      if (finalPrice > 0) {
        const { success: deductSuccess, error: deductError } = await deductCoins({
          userId: user.id,
          amount: finalPrice,
          type: 'purchase',
          coinType: 'troll_coins',
          description: `Vehicle purchase: ${vehicleName}`,
          metadata: {
            vehicle_name: vehicleName,
            make,
            model,
            year,
          },
        })

        if (!deductSuccess) {
          return {
            success: false,
            error: deductError || 'Insufficient coins to purchase vehicle',
          }
        }
      }

      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .insert({
          owner_user_id: user.id,
          vehicle_name: vehicleName,
          make,
          model,
          year,
          plate_number: licensePlate,
          plate_status: 'active',
        })
        .select()
        .single()

      if (vehicleError) throw vehicleError

      if (withLoan) {
        const { error: loanError } = await supabase.from('vehicle_loans').insert({
          vehicle_id: vehicle.id,
          total_amount: LOAN_AMOUNT,
          remaining_amount: LOAN_AMOUNT,
          monthly_payment: MONTHLY_PAYMENT,
          is_default: false,
          cashout_hold_until: null,
        })

        if (loanError) throw loanError
      }

      await supabase
        .from('user_profiles')
        .update({
          vehicle_id: vehicle.id,
          license_plate: licensePlate,
        })
        .eq('id', user.id)

      await fetchVehicles()

      return { success: true, vehicle }
    } catch (error: any) {
      console.error('Error purchasing vehicle:', error)
      return {
        success: false,
        error: error?.message || 'Unable to purchase vehicle',
      }
    }
  }

  const updatePlate = async (plateText: string) => {
    if (!user?.id || !activeVehicle) {
      return { success: false, error: 'No vehicle' }
    }

    try {
      const normalizedPlate = plateText.trim().toUpperCase()

      if (!normalizedPlate) {
        return { success: false, error: 'License plate cannot be empty' }
      }

      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({
          plate_number: normalizedPlate,
          plate_status: 'active',
        })
        .eq('id', activeVehicle.id)
        .eq('owner_user_id', user.id)

      if (vehicleError) throw vehicleError

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          license_plate: normalizedPlate,
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      await fetchVehicles()

      return { success: true }
    } catch (error: any) {
      console.error('Error updating plate:', error)
      return {
        success: false,
        error: error?.message || 'Unable to update license plate',
      }
    }
  }

  const getActiveLoan = async (vehicleId: string): Promise<VehicleLoan | null> => {
    try {
      const { data, error } = await supabase
        .from('vehicle_loans')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .gt('remaining_amount', 0)
        .maybeSingle()

      if (error) throw error

      return data || null
    } catch (error) {
      console.error('Error fetching loan:', error)
      return null
    }
  }

  const hasActiveLoan = async (): Promise<boolean> => {
    if (!activeVehicle) return false

    const loan = await getActiveLoan(activeVehicle.id)
    return !!loan
  }

  const isCashoutOnHold = async (): Promise<boolean> => {
    if (!activeVehicle) return false

    const loan = await getActiveLoan(activeVehicle.id)

    if (!loan?.cashout_hold_until) return false

    return new Date(loan.cashout_hold_until) > new Date()
  }

  const recordDrivingViolation = async (): Promise<{
    success: boolean
    message: string
  }> => {
    if (!user?.id) {
      return { success: false, message: 'Not authenticated' }
    }

    try {
      const { data: currentProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('license_status, license_strikes, insurance_required')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      const newStrikes = Number(currentProfile?.license_strikes || 0) + 1

      const { error: updateProfileError } = await supabase
        .from('user_profiles')
        .update({
          license_status: 'suspended',
          license_strikes: newStrikes,
          insurance_required: true,
          license_suspended_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updateProfileError) throw updateProfileError

      await supabase
        .from('user_licenses')
        .update({
          status: 'suspended',
          suspended_until: null,
        })
        .eq('user_id', user.id)

      await supabase
        .from('vehicles')
        .update({
          plate_status: 'suspended',
        })
        .eq('owner_user_id', user.id)

      return {
        success: true,
        message:
          'Driving without an active license is not allowed. Your license has been suspended and insurance is now required.',
      }
    } catch (error) {
      console.error('Error recording violation:', error)
      return {
        success: false,
        message: 'Failed to record violation',
      }
    }
  }

  const canUserDrive = async (): Promise<{
    canDrive: boolean
    message?: string
  }> => {
    if (!user?.id) {
      return {
        canDrive: false,
        message: 'Not authenticated',
      }
    }

    try {
      const { data: currentProfile, error } = await supabase
        .from('user_profiles')
        .select('license_status, insurance_required')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (currentProfile?.license_status === 'active') {
        return { canDrive: true }
      }

      if (currentProfile?.license_status === 'suspended') {
        return {
          canDrive: false,
          message:
            'Your license is suspended. Get your license restored and make sure insurance requirements are handled before driving.',
        }
      }

      return {
        canDrive: false,
        message: 'You need an active Mai Troll license to use vehicles.',
      }
    } catch (error) {
      console.error('Error checking drive permission:', error)
      return {
        canDrive: false,
        message: 'Unable to verify license status',
      }
    }
  }

  return {
    vehicles,
    activeVehicle,
    loading,
    fetchVehicles,
    purchaseVehicle,
    updatePlate,
    hasActiveLoan,
    isCashoutOnHold,
    getActiveLoan,
    recordDrivingViolation,
    canUserDrive,
  }
}

export function useDriverTest() {
  const { user, profile, setProfile } = useAuthStore()
  const [test, setTest] = useState<DriverTest | null>(null)
  const [license, setLicense] = useState<UserLicense | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchLicense = useCallback(async () => {
    if (!user?.id) {
      setTest(null)
      setLicense(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const { data: testData, error: testError } = await supabase
        .from('driver_tests')
        .select('*')
        .eq('user_id', user.id)
        .order('test_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (testError) {
        console.warn('Unable to fetch latest driver test:', testError)
      } else {
        setTest(testData || null)
      }

      const { data: licenseData, error: licenseError } = await supabase
        .from('user_licenses')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (licenseError) {
        console.warn('Unable to fetch user license:', licenseError)
      } else {
        setLicense(licenseData || null)
      }
    } catch (error) {
      console.error('Error fetching license:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchLicense()
  }, [fetchLicense])

  const grantLicense = async (): Promise<{
    success: boolean
    passed: boolean
    score: number
    message?: string
    licenseNumber?: string
  }> => {
    if (!user?.id) {
      return {
        success: false,
        passed: false,
        score: 0,
        message: 'Not authenticated',
      }
    }

    try {
      setLoading(true)

      const now = new Date().toISOString()
      const licenseNumber = generateLicenseNumber()
      const expiry = getLicenseExpiry()

      /**
       * Pull current profile only to preserve existing fields in Zustand sync.
       * The license is granted directly now. There is no actual quiz.
       */
      const { data: currentProfile, error: profileFetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileFetchError) throw profileFetchError

      const profileUpdate: Record<string, any> = {
        license_status: 'active',
        driver_test_passed_at: now,
        license_activated_at: now,
        drivers_license_expiry: expiry,
      }

      /**
       * Keep insurance_required as-is.
       * This means the user can get the license, but your other vehicle/insurance
       * systems can still enforce insurance where needed.
       */
      const { error: profileUpdateError } = await supabase
        .from('user_profiles')
        .update(profileUpdate)
        .eq('id', user.id)

      if (profileUpdateError) throw profileUpdateError

      const { data: existingLicense, error: existingLicenseError } = await supabase
        .from('user_licenses')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingLicenseError) throw existingLicenseError

      if (existingLicense?.id) {
        const { error: licenseUpdateError } = await supabase
          .from('user_licenses')
          .update({
            license_number: licenseNumber,
            status: 'active',
            issued_at: now,
            expires_at: expiry,
            suspended_until: null,
          })
          .eq('user_id', user.id)

        if (licenseUpdateError) throw licenseUpdateError
      } else {
        const { error: licenseInsertError } = await supabase
          .from('user_licenses')
          .insert({
            user_id: user.id,
            license_number: licenseNumber,
            status: 'active',
            issued_at: now,
            expires_at: expiry,
            suspended_until: null,
          })

        if (licenseInsertError) throw licenseInsertError
      }

      /**
       * Keep writing to driver_tests so old dashboards, onboarding checks,
       * and neighborhood logic that look for a passed driver_tests row still work.
       */
      const { error: testInsertError } = await supabase
        .from('driver_tests')
        .insert({
          user_id: user.id,
          score: 10,
          passed: true,
          test_date: now,
          license_number: licenseNumber,
        })

      if (testInsertError) throw testInsertError

      setProfile({
        ...(profile || currentProfile),
        ...profileUpdate,
      } as any)

      await fetchLicense()

      return {
        success: true,
        passed: true,
        score: 10,
        message: 'MaiTroll license granted. Your license is now active.',
        licenseNumber,
      }
    } catch (error: any) {
      console.error('Error granting license:', error)

      return {
        success: false,
        passed: false,
        score: 0,
        message: error?.message || 'Unable to grant license',
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Compatibility wrapper.
   * Old DriverTest pages may still call takeTest(answers, correctAnswers).
   * Now it simply grants the license without checking answers.
   */
  const takeTest = async (): Promise<{
    success: boolean
    passed: boolean
    score: number
    message?: string
    licenseNumber?: string
  }> => {
    return grantLicense()
  }

  const checkSuspension = async (): Promise<{
    suspended: boolean
    reason: string
  }> => {
    if (!license) {
      return {
        suspended: false,
        reason: '',
      }
    }

    if ((license as any).reports_count_week >= 5) {
      return {
        suspended: true,
        reason: '5+ reports this week',
      }
    }

    if ((license as any).arrests_count_week >= 2) {
      return {
        suspended: true,
        reason: '2+ arrests this week',
      }
    }

    if (license.suspended_until && new Date(license.suspended_until) > new Date()) {
      return {
        suspended: true,
        reason: 'License suspended',
      }
    }

    if (license.status === 'suspended') {
      return {
        suspended: true,
        reason: 'License suspended',
      }
    }

    return {
      suspended: false,
      reason: '',
    }
  }

  const checkAndSuspendExpiredInsurance = async () => {
    if (!user?.id) return

    try {
      const { data: licenses, error: licenseError } = await supabase
        .from('user_licenses')
        .select('user_id, status')
        .eq('status', 'active')

      if (licenseError) throw licenseError
      if (!licenses?.length) return

      for (const licenseRow of licenses) {
        const { data: carInsurance } = await supabase
          .from('car_insurances')
          .select('expires_at')
          .eq('user_id', licenseRow.user_id)
          .maybeSingle()

        const { data: homeInsurance } = await supabase
          .from('homeowners_insurances')
          .select('expires_at')
          .eq('user_id', licenseRow.user_id)
          .maybeSingle()

        const now = new Date()
        const carExpired =
          !!carInsurance?.expires_at && new Date(carInsurance.expires_at) < now
        const homeExpired =
          !!homeInsurance?.expires_at && new Date(homeInsurance.expires_at) < now

        if (carExpired && homeExpired) {
          await supabase
            .from('user_licenses')
            .update({
              status: 'suspended',
              suspended_until: null,
            })
            .eq('user_id', licenseRow.user_id)

          await supabase
            .from('user_profiles')
            .update({
              license_status: 'suspended',
              license_suspended_at: new Date().toISOString(),
            })
            .eq('id', licenseRow.user_id)

          await supabase
            .from('vehicles')
            .update({
              plate_status: 'suspended',
            })
            .eq('owner_user_id', licenseRow.user_id)
        }
      }
    } catch (error) {
      console.error('Error checking and suspending expired insurance:', error)
    }
  }

  return {
    test,
    license,
    loading,
    grantLicense,
    takeTest,
    checkSuspension,
    fetchLicense,
    checkAndSuspendExpiredInsurance,
  }
}