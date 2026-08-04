import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Car,
  Check,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { useNeighborhood } from '../lib/hooks/useNeighborhood'
import { useVehicleSystem, useDriverTest } from '../lib/hooks/useVehicleSystem'
import { deductCoins } from '../lib/coinTransactions'

import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Label } from '../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'

import {
  CAR_OPTIONS,
  DOOR_COLORS,
  HOUSE_TYPES,
  ROOF_STYLES,
  TRIM_COLORS,
  WINDOW_STYLES,
  YARD_DECORATIONS,
} from '../lib/neighborhoodAssets'

type OnboardingScene = 'choice' | 'street' | 'car' | 'driverTest' | 'insurance' | 'license' | 'complete'

export default function NeighborhoodOnboarding() {
  const navigate = useNavigate()

  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)

  const { createNeighborhood, checkInvites, acceptInvite, joinNeighborhoodByLeaderId } = useNeighborhood()
  const {
    activeVehicle,
    purchaseVehicle,
    updatePlate,
    loading: vehicleLoading,
  } = useVehicleSystem()

  const {
    license,
    grantLicense,
    takeTest,
    loading: licenseLoading,
  } = useDriverTest()

  const [currentScene, setCurrentScene] = useState<OnboardingScene>('street')
  const [loading, setLoading] = useState(true)

  const [streetName, setStreetName] = useState('MaiTroll Lane')
  const [zipCode, setZipCode] = useState('00001')
  const [houseCount, setHouseCount] = useState(5)

  const [houseStyle, setHouseStyle] = useState(HOUSE_TYPES[0].id)
  const [doorColor, setDoorColor] = useState(DOOR_COLORS[0].id)
  const [trimColor, setTrimColor] = useState(TRIM_COLORS[0].id)
  const [windowStyle, setWindowStyle] = useState(WINDOW_STYLES[0].id)
  const [roofStyle, setRoofStyle] = useState(ROOF_STYLES[0].id)
  const [yardDecoration, setYardDecoration] = useState(YARD_DECORATIONS[0].id)

  const [selectedCarId, setSelectedCarId] = useState(CAR_OPTIONS[0].id)
  const [purchasingCar, setPurchasingCar] = useState(false)

  const [grantingLicense, setGrantingLicense] = useState(false)
  const [insuranceBuying, setInsuranceBuying] = useState(false)
  const [homeInsuranceBuying, setHomeInsuranceBuying] = useState(false)
  const [driversLicenseExpiry, setDriversLicenseExpiry] = useState<string | null>(null)

  const [plateText, setPlateText] = useState('TROLL123')
  const [updatingPlate, setUpdatingPlate] = useState(false)
  const [creatingNeighborhood, setCreatingNeighborhood] = useState(false)

  const [completeMessage, setCompleteMessage] = useState('')
  const [hasFreeInsurance, setHasFreeInsurance] = useState(false)

  const [sceneTransitioning, setSceneTransitioning] = useState(false)
  const [showSceneCelebration, setShowSceneCelebration] = useState(false)
  const [celebrationMessage, setCelebrationMessage] = useState('')
  const [showSetupReminder, setShowSetupReminder] = useState(false)
  const [followedNeighbors, setFollowedNeighbors] = useState<Array<{ id: string; username: string }>>([])
  const [joiningNeighborhood, setJoiningNeighborhood] = useState(false)

  const isMountedRef = useRef(true)
  const profileRef = useRef(profile)
  const checkingRef = useRef(false)

  const checkInvitesRef = useRef(checkInvites)
  const acceptInviteRef = useRef(acceptInvite)
  const refreshProfileRef = useRef(refreshProfile)

  profileRef.current = profile
  checkInvitesRef.current = checkInvites
  acceptInviteRef.current = acceptInvite
  refreshProfileRef.current = refreshProfile

  const selectedCar = useMemo(
    () => CAR_OPTIONS.find((car) => car.id === selectedCarId) || CAR_OPTIONS[0],
    [selectedCarId]
  )

  const progressSteps = useMemo(
  () => [
    { id: 'street', title: 'Build Your Street' },
    { id: 'car', title: 'Choose Your Ride' },
    { id: 'driverTest', title: 'Get License' },
    { id: 'insurance', title: 'Buy Insurance' },
    { id: 'license', title: 'Plate Your Car' },
    { id: 'complete', title: 'Enter the Neighborhood' },
  ],
  []
)

  const currentStepIndex = useMemo(
    () => progressSteps.findIndex((step) => step.id === currentScene),
    [currentScene]
  )

  const selectedHouseConfig = useMemo(() => {
    return {
      houseType: HOUSE_TYPES.find((item) => item.id === houseStyle)?.label || 'Townhouse',
      doorColor: DOOR_COLORS.find((item) => item.id === doorColor)?.label || 'Neon Blue',
      trimColor: TRIM_COLORS.find((item) => item.id === trimColor)?.label || 'Gold',
      windowStyle: WINDOW_STYLES.find((item) => item.id === windowStyle)?.label || 'Arched',
      roofStyle: ROOF_STYLES.find((item) => item.id === roofStyle)?.label || 'Flat Roof',
      yardDecoration:
        YARD_DECORATIONS.find((item) => item.id === yardDecoration)?.label || 'Garden',
    }
  }, [doorColor, houseStyle, roofStyle, trimColor, windowStyle, yardDecoration])

  const driverStatus = useMemo(() => {
    const profileAny = profile as any

    if (profileAny?.license_status === 'active' || license?.status === 'active') {
      return 'Active'
    }

    if (profileAny?.license_status === 'suspended' || license?.status === 'suspended') {
      return 'Suspended'
    }

    return 'No License'
  }, [profile, license?.status])

  const insuranceStatusDisplay = useMemo(() => {
    const profileAny = profile as any

    const hasCarInsurance =
      profileAny?.car_insurance_expiry &&
      new Date(profileAny.car_insurance_expiry) > new Date()

    const hasHomeInsurance =
      profileAny?.homeowners_insurance_expiry &&
      new Date(profileAny.homeowners_insurance_expiry) > new Date()

    if (hasCarInsurance && hasHomeInsurance) {
      return 'Fully Insured'
    }
    if (hasCarInsurance) {
      return 'Car Insured'
    }
    if (hasHomeInsurance) {
      return 'Home Insured'
    }

    return 'Pending'
  }, [profile])

  const licenseExpiryDisplay = useMemo(() => {
    const profileAny = profile as any
    return profileAny?.drivers_license_expiry || driversLicenseExpiry || null
  }, [profile, driversLicenseExpiry])

  useEffect(() => {
    const hasSeenReminder = localStorage.getItem('tc_neighborhood_setup_reminder_seen')
    const oldReminder = localStorage.getItem('tc_neighborhood_test_reminder_seen')

    if (!hasSeenReminder && !oldReminder) {
      setShowSetupReminder(true)
    }
  }, [])

  useEffect(() => {
    const draft = localStorage.getItem('tc_onboarding_draft')

    if (!draft) return

    try {
      const d = JSON.parse(draft)

      if (d.streetName) setStreetName(d.streetName)
      if (d.zipCode) setZipCode(d.zipCode)
      if (d.houseCount) setHouseCount(d.houseCount)
      if (d.houseStyle) setHouseStyle(d.houseStyle)
      if (d.doorColor) setDoorColor(d.doorColor)
      if (d.trimColor) setTrimColor(d.trimColor)
      if (d.windowStyle) setWindowStyle(d.windowStyle)
      if (d.roofStyle) setRoofStyle(d.roofStyle)
      if (d.yardDecoration) setYardDecoration(d.yardDecoration)
      if (d.selectedCarId) setSelectedCarId(d.selectedCarId)
      if (d.plateText) setPlateText(d.plateText)
    } catch {
      localStorage.removeItem('tc_onboarding_draft')
    }
  }, [])

  useEffect(() => {
    const draft = {
      streetName,
      zipCode,
      houseCount,
      houseStyle,
      doorColor,
      trimColor,
      windowStyle,
      roofStyle,
      yardDecoration,
      selectedCarId,
      plateText,
      currentScene: currentScene === 'complete' ? 'street' : currentScene,
    }

    localStorage.setItem('tc_onboarding_draft', JSON.stringify(draft))
  }, [
    streetName,
    zipCode,
    houseCount,
    houseStyle,
    doorColor,
    trimColor,
    windowStyle,
    roofStyle,
    yardDecoration,
    selectedCarId,
    plateText,
    currentScene,
  ])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (currentScene !== 'insurance' || !user?.id) return

    const checkFreeInsurance = async () => {
      const { data: existing } = await supabase
        .from('car_insurances')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (isMountedRef.current) {
        setHasFreeInsurance(!existing)
      }
    }

    checkFreeInsurance()
  }, [currentScene, user?.id])

  useEffect(() => {
    if (!user?.id) return
    if (checkingRef.current) return

    checkingRef.current = true

    const checkUserStatus = async () => {
      setLoading(true)

      try {
        const { data: freshProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        const profileAny = (freshProfile || profileRef.current) as any

        const hasNeighborhood = !!profileAny?.neighborhood_id
        const hasHouse = !!profileAny?.house_id
        const hasVehicle = !!profileAny?.vehicle_id
        const carInsuranceValid = profileAny?.car_insurance_expiry
          ? new Date(profileAny.car_insurance_expiry) > new Date()
          : false
        const hasPlate = !!profileAny?.license_plate

        const { data: activeHomeInsurance } = await supabase
          .from('homeowners_insurances')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .limit(1)
          .maybeSingle()

        const homeInsuranceValid = !!activeHomeInsurance

        const hasRestorableLicense =
          profileAny?.license_status === 'suspended' &&
          carInsuranceValid &&
          !!profileAny?.driver_test_passed_at

        const hasLicense = profileAny?.license_status === 'active' || hasRestorableLicense

        if (profileAny?.drivers_license_expiry) {
          setDriversLicenseExpiry(profileAny.drivers_license_expiry)
        }

        if (freshProfile) {
          const currentProfile = useAuthStore.getState().profile

          if (currentProfile) {
            const merged = { ...currentProfile, ...freshProfile }

            const keys = [
              'license_status',
              'car_insurance_expiry',
              'drivers_license_expiry',
              'neighborhood_id',
              'house_id',
              'vehicle_id',
              'license_plate',
              'troll_coins',
            ] as const

            const changed = keys.some(
              (key) => (merged as any)[key] !== (currentProfile as any)[key]
            )

            if (changed) {
              setProfile(merged)
            }
          }
        }

        const { hasAcceptedInvites } = await checkInvitesRef.current()
        const isFamilyMember = hasAcceptedInvites && !hasNeighborhood

        if (isFamilyMember) {
          try {
            await acceptInviteRef.current()
            await refreshProfileRef.current()
          } catch (error) {
            console.error('Error accepting family invite:', error)
          }
        }

        if (!isMountedRef.current) return

        console.log('[NeighborhoodOnboarding] checkUserStatus:', {
          hasNeighborhood,
          hasHouse,
          hasVehicle,
          hasPlate,
          hasLicense,
          hasRestorableLicense,
          carInsuranceValid,
          homeInsuranceValid,
          profileNeighborhoodId: profileAny?.neighborhood_id,
        });

        let nextScene: OnboardingScene = 'street'
        let nextMessage = ''

        if (hasNeighborhood && hasHouse && hasVehicle && carInsuranceValid && homeInsuranceValid && hasPlate && hasLicense) {
          nextScene = 'complete'
          nextMessage = 'Your neighborhood is ready. Enter the streets of Mai Troll!'
        } else if (isFamilyMember) {
          if (!hasVehicle) {
            nextScene = 'car'
          } else if (!hasLicense && !hasRestorableLicense) {
            nextScene = 'driverTest'
          } else if (!carInsuranceValid || !homeInsuranceValid) {
            nextScene = 'insurance'
          } else if (!hasPlate) {
            nextScene = 'license'
          } else {
            nextScene = 'complete'
            nextMessage = 'Welcome to your family neighborhood! Enter the streets of Mai Troll!'
          }
        } else if (!hasNeighborhood || !hasHouse) {
          const { data: followedUsers, error: followsError } = await supabase
            .from('user_follows')
            .select('following_id')
            .eq('follower_id', user.id)

          if (!followsError && followedUsers && followedUsers.length > 0) {
            const followingIds = followedUsers.map((f) => f.following_id).filter(Boolean)
            const { data: neighborLeaders } = await supabase
              .from('neighborhoods')
              .select('leader_user_id, id, name')
              .in('leader_user_id', followingIds)

            if (neighborLeaders && neighborLeaders.length > 0) {
              const { data: profiles } = await supabase
                .from('user_profiles')
                .select('id, username')
                .in('id', neighborLeaders.map((n) => n.leader_user_id))

              const profileMap = new Map((profiles || []).map((p) => [p.id, p.username]))
              const neighborsWithProfiles = neighborLeaders.map((n) => ({
                id: n.leader_user_id,
                username: profileMap.get(n.leader_user_id) || 'Unknown',
              }))
              setFollowedNeighbors(neighborsWithProfiles)
              nextScene = 'choice'
            } else {
              nextScene = 'street'
            }
          } else {
            nextScene = 'street'
          }
        } else if (!hasVehicle) {
          nextScene = 'car'
        } else if (!hasLicense && !hasRestorableLicense) {
          nextScene = 'driverTest'
        } else if (!carInsuranceValid || !homeInsuranceValid) {
          nextScene = 'insurance'
        } else if (!hasPlate) {
          nextScene = 'license'
        }

        setCurrentScene(nextScene)

        if (nextMessage) {
          setCompleteMessage(nextMessage)
        }
      } catch (error) {
        console.error('Neighborhood onboarding status check failed:', error)
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
        }

        checkingRef.current = false
      }
    }

    checkUserStatus()
  }, [user?.id])

  const clearDraft = () => {
    localStorage.removeItem('tc_onboarding_draft')
  }

  const transitionToScene = (nextScene: OnboardingScene, celebrationMsg = '') => {
    if (nextScene === 'complete') {
      clearDraft()
    }

    setSceneTransitioning(true)

    if (celebrationMsg) {
      setCelebrationMessage(celebrationMsg)
      setShowSceneCelebration(true)

      window.setTimeout(() => {
        setShowSceneCelebration(false)
        setCurrentScene(nextScene)
        setSceneTransitioning(false)
      }, 2200)

      return
    }

    window.setTimeout(() => {
      setCurrentScene(nextScene)
      setSceneTransitioning(false)
    }, 650)
  }

  const streetPreview = () => {
    const houses = Array.from({ length: houseCount }, (_, index) => index + 1)

    return (
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {houses.map((houseNumber) => (
          <div
            key={houseNumber}
            className={`relative rounded-3xl border p-4 shadow-lg ${
              houseNumber === 1
                ? 'border-indigo-400 bg-indigo-950/40'
                : 'border-slate-700 bg-slate-900/60'
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
                House {houseNumber}
              </span>

              <Badge variant="secondary" className="text-[10px] uppercase">
                {houseNumber === 1 ? 'Your House' : 'Family Slot'}
              </Badge>
            </div>

            <div className="flex h-24 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-center text-sm text-white">
              {houseNumber === 1 ? 'Home Base' : 'Future Family Home'}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const neighborhoodMapPreview = () => {
    const houses = Array.from({ length: houseCount }, (_, index) => index + 1)

    return (
      <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm uppercase tracking-[0.24em] text-slate-400">
              Neighborhood Map
            </div>
            <div className="text-lg font-semibold text-white">{streetName}</div>
          </div>

          <Badge variant="secondary" className="text-xs uppercase tracking-[0.24em]">
            ZIP {zipCode}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {houses.map((houseNumber) => (
            <div
              key={houseNumber}
              className={`rounded-3xl border p-4 shadow-sm shadow-black/10 ${
                houseNumber === 1
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : 'border-slate-700 bg-slate-900/80'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Block {houseNumber}</span>
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {houseNumber === 1 ? 'Main' : 'Family'}
                </Badge>
              </div>

              <div className="space-y-1 text-xs text-slate-300">
                <div>{houseNumber === 1 ? 'Leader home' : 'Open slot'}</div>
                <div>{houseNumber === 1 ? selectedHouseConfig.houseType : 'House slot'}</div>
              </div>

              <div className="mt-3 flex h-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                {houseNumber === 1 ? 'Home Base' : 'Family Slot'}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-300">
          <div className="font-semibold text-slate-100">Game Notes</div>

          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Lead your home block to become the safest street.</li>
            <li>Invite family members to fill open slots and expand your block.</li>
            <li>Unlock house upgrades, officer patrols, and neighborhood raids.</li>
          </ul>
        </div>
      </div>
    )
  }

  const handleCreateStreet = async () => {
    if (!streetName.trim() || !zipCode.trim()) {
      toast.error('Street name and zip code are required')
      return
    }

    if (!/^[A-Z0-9 ]{3,8}$/i.test(zipCode)) {
      toast.error('Zip code must be 3-8 letters or numbers')
      return
    }

    setCreatingNeighborhood(true)

    try {
      const result = await createNeighborhood(streetName.trim(), zipCode.trim(), houseCount)

      if (!result.success) {
        toast.error(result.error || 'Unable to create your street')
        return
      }

      await refreshProfile(true)

      toast.success('Street created! Next stop: your car')
      transitionToScene('car', '🏘️ Street built! Time to choose your ride!')
    } catch (error: any) {
      toast.error(error?.message || 'Neighborhood creation failed')
    } finally {
      setCreatingNeighborhood(false)
    }
  }

  const handlePurchaseCar = async () => {
    if (!selectedCar) return

    if (!user?.id) {
      toast.error('Must be signed in')
      return
    }

    setPurchasingCar(true)

    try {
      const result = await purchaseVehicle(
        selectedCar.name,
        'TrollMotors',
        selectedCar.name,
        2026,
        selectedCar.price,
        false
      )

      if (!result.success) {
        toast.error(result.error || 'Unable to buy this car')
        return
      }

      await refreshProfile(true)

      toast.success(`${selectedCar.name} is yours!`)
      transitionToScene('driverTest', '🚗 Car purchased! Now get your Mai Troll license!')
    } catch (error: any) {
      toast.error(error?.message || 'Purchase failed')
    } finally {
      setPurchasingCar(false)
    }
  }

  const handleGrantDriverLicense = async () => {
    if (!user?.id) {
      toast.error('Must be signed in')
      return
    }

    setGrantingLicense(true)

    try {
      const result =
        typeof grantLicense === 'function'
          ? await grantLicense()
          : await takeTest()

      if (!result.success || !result.passed) {
        toast.error(result.message || 'Unable to grant license')
        return
      }

      const now = new Date().toISOString()

      await refreshProfile(true)

      const refreshedProfile = useAuthStore.getState().profile

      if (refreshedProfile) {
        setProfile({
          ...refreshedProfile,
          license_status: 'active',
          driver_test_passed_at: now,
          license_activated_at: now,
          drivers_license_expiry:
            (refreshedProfile as any).drivers_license_expiry ||
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        } as any)
      }

      toast.success('License granted! Time to get insured.')
      transitionToScene('insurance', '🎓 License granted! Now get insured!')
    } catch (error: any) {
      console.error('License grant error:', error)
      toast.error(error?.message || 'Unable to grant license')
    } finally {
      setGrantingLicense(false)
    }
  }

  const handlePurchaseInsurance = async () => {
    const profileAny = profile as any
    const currentVehicleId = profileAny?.vehicle_id || activeVehicle?.id

    if (!currentVehicleId) {
      toast.error('No active vehicle to insure')
      return
    }

    if (!user?.id) {
      toast.error('Not authenticated')
      return
    }

    setInsuranceBuying(true)

    try {
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const now = new Date().toISOString()

      const { data: existingInsurance } = await supabase
        .from('car_insurances')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      const firstInsurance = !existingInsurance

      const shouldRestoreLicense =
        profileAny?.license_status === 'suspended' &&
        !!profileAny?.driver_test_passed_at

      const shouldActivateLicense =
        profileAny?.license_status !== 'active' &&
        !!profileAny?.driver_test_passed_at

      let houseId = profileAny?.house_id || null

      if (!houseId) {
        const { data: houseRow } = await supabase
          .from('houses')
          .select('id')
          .eq('owner_user_id', user.id)
          .limit(1)
          .maybeSingle()

        houseId = houseRow?.id || null
      }

      const profileUpdate: any = {}

      if (shouldRestoreLicense) {
        profileUpdate.license_status = 'active'
        profileUpdate.license_restored_at = now
        profileUpdate.insurance_required = false
        profileUpdate.drivers_license_expiry = expiry
      } else if (shouldActivateLicense) {
        profileUpdate.license_status = 'active'
        profileUpdate.license_activated_at = now
        profileUpdate.drivers_license_expiry = expiry
      }

      const { error: carInsuranceError } = await supabase.from('car_insurances').insert({
        user_id: user.id,
        vehicle_id: currentVehicleId,
        expires_at: expiry,
        deductible_paid: 0,
        status: 'active',
        starts_at: now,
      })

      if (carInsuranceError) throw carInsuranceError

      profileUpdate.car_insurance_expiry = expiry

      if (houseId) {
        const { error: homeInsuranceError } = await supabase
          .from('homeowners_insurances')
          .insert({
            user_id: user.id,
            house_id: houseId,
            expires_at: expiry,
            deductible_paid: 0,
            status: 'active',
            is_active: true,
            plan_id: 'basic_week',
            coverage_type: 'basic',
            cost_paid: 0,
            deductible: 25,
            duration_hours: 720,
            purchased_at: now,
            claims_made: 0,
          })

        if (homeInsuranceError) throw homeInsuranceError
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update(profileUpdate)
        .eq('id', user.id)

      if (profileError) throw profileError

      if (profile) {
        setProfile({
          ...profile,
          ...profileUpdate,
        } as any)
      }

      if (shouldRestoreLicense || shouldActivateLicense) {
        setDriversLicenseExpiry(expiry)
      }

      await refreshProfile(true)

      toast.success(
        firstInsurance
          ? 'Free car insurance activated for 30 days!'
          : 'Car insurance active for 30 days'
      )
    } catch (error: any) {
      console.error('Insurance error:', error)
      toast.error(error?.message || 'Unable to purchase insurance')
    } finally {
      setInsuranceBuying(false)
    }
  }

  const handlePurchaseHomeInsurance = async () => {
    if (!user?.id) {
      toast.error('Not authenticated')
      return
    }

    const profileAny = profile as any

    if (profileAny?.troll_coins < 500) {
      toast.error('You need 500 Troll Coins to purchase home insurance')
      return
    }

    let houseId = profileAny?.house_id || null

    if (!houseId) {
      const { data: houseRow } = await supabase
        .from('houses')
        .select('id')
        .eq('owner_user_id', user.id)
        .limit(1)
        .maybeSingle()

      houseId = houseRow?.id || null
    }

    if (!houseId) {
      toast.error('No house found to insure')
      return
    }

    setHomeInsuranceBuying(true)

    try {
      const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const now = new Date().toISOString()

      const { success, error: deductError } = await deductCoins({
        userId: user.id,
        amount: 500,
        type: 'insurance_purchase',
        coinType: 'troll_coins',
        description: 'Homeowners insurance - 7 days',
        metadata: {
          house_id: houseId,
          duration_days: 7,
        },
      })

      if (!success) {
        throw new Error(deductError || 'Insufficient coins to purchase home insurance')
      }

      const { error: homeInsuranceError } = await supabase
        .from('homeowners_insurances')
        .insert({
          user_id: user.id,
          house_id: houseId,
          expires_at: expiry,
          deductible_paid: 0,
          status: 'active',
          is_active: true,
          plan_id: 'basic_week',
          coverage_type: 'basic',
          cost_paid: 500,
          deductible: 25,
          duration_hours: 168,
          purchased_at: now,
          claims_made: 0,
        })

      if (homeInsuranceError) throw homeInsuranceError

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          homeowners_insurance_expiry: expiry,
          homeowners_insurance_deductible: 25,
          role: 'broadcaster',
          is_broadcaster: true,
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      await refreshProfile(true)

      toast.success('Home insurance activated for 7 days! You can now broadcast.')

      transitionToScene('license', '🏠 Home insured! Now customize your license plate!')
    } catch (error: any) {
      console.error('Home insurance error:', error)
      toast.error(error?.message || 'Unable to purchase home insurance')
    } finally {
      setHomeInsuranceBuying(false)
    }
  }

  const handleSavePlate = async () => {
    const profileAny = profile as any
    const currentVehicleId = profileAny?.vehicle_id || activeVehicle?.id

    if (!currentVehicleId) {
      toast.error('No active vehicle found')
      return
    }

    if (!user?.id) {
      toast.error('Not authenticated')
      return
    }

    const normalized = plateText.trim().toUpperCase()

    if (!/^[A-Z0-9]{1,8}$/.test(normalized)) {
      toast.error('Plate must be 1-8 letters or numbers')
      return
    }

    setUpdatingPlate(true)

    try {
      const result = await updatePlate(normalized)

      if (!result.success) {
        toast.error(result.error || 'Unable to save plate')
        return
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          license_plate: normalized,
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile(true)

      toast.success('License plate saved')
      transitionToScene('complete', '🏆 License complete! Welcome to Mai Troll!')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save license plate')
    } finally {
      setUpdatingPlate(false)
    }
  }

  const handleJoinNeighborhood = async (leaderUserId: string, username: string) => {
    if (!user?.id) {
      toast.error('Not authenticated')
      return
    }

    setJoiningNeighborhood(true)

    try {
      const { success, error } = await joinNeighborhoodByLeaderId(leaderUserId)

      if (!success) {
        toast.error(error || 'Failed to join neighborhood')
        return
      }

      await refreshProfile(true)
      toast.success(`Joined ${username}'s neighborhood!`)

      const profileAny = profile as any
      const hasVehicle = !!profileAny?.vehicle_id
      const carInsuranceValid = profileAny?.car_insurance_expiry
        ? new Date(profileAny.car_insurance_expiry) > new Date()
        : false

      if (!hasVehicle) {
        transitionToScene('car', '🚗 Welcome to the neighborhood! Now pick your starter car.')
      } else if (!carInsuranceValid) {
        transitionToScene('insurance', '🚗 Welcome to the neighborhood! Now get insured.')
      } else {
        transitionToScene('complete', '🏆 Welcome to the neighborhood!')
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to join neighborhood')
    } finally {
      setJoiningNeighborhood(false)
    }
  }

  if (loading || vehicleLoading || licenseLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-14 w-14 animate-spin rounded-full border-b-2 border-t-2 border-purple-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0d1222] to-[#1c1334] px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-600/20 px-4 py-2 text-sm font-semibold text-violet-200">
              <Sparkles className="h-4 w-4 text-violet-300" />
              Neighborhood Setup: Mai Troll Edition
            </div>

            <h1 className="mt-4 text-4xl font-bold tracking-tight">
              Launch your first Mai Troll street
            </h1>

            <p className="mt-3 max-w-2xl text-slate-400">
              A gamified neighborhood setup that turns onboarding into a city builder adventure.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {progressSteps.map((step, index) => (
              <div
                key={step.id}
                className={`rounded-3xl border p-3 text-xs ${
                  index <= currentStepIndex
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-slate-700 bg-slate-900/60'
                }`}
              >
                <div className="font-semibold text-slate-100">{index + 1}</div>
                <div className="mt-1 text-slate-400">{step.title}</div>
              </div>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden border-slate-700 bg-slate-900/80 shadow-2xl shadow-black/20">
          <CardHeader className="border-b border-slate-700 bg-slate-950/90 px-6 py-5">
            <CardTitle className="text-xl text-white">
              {currentScene === 'choice' && 'Choose Your Path'}
              {currentScene === 'street' && 'Scene 1: Create Your First Home'}
              {currentScene === 'car' && 'Scene 2: Choose Your Starter Car'}
              {currentScene === 'driverTest' && 'Scene 3: Get License'}
              {currentScene === 'insurance' && 'Scene 4: Buy Car Insurance'}
              {currentScene === 'license' && 'Scene 5: Customize Your License'}
              {currentScene === 'complete' && 'Scene 6: Enter Neighborhood'}
            </CardTitle>
          </CardHeader>

          <CardContent className="grid gap-8 p-6 lg:grid-cols-[1fr_420px]">
            <div className="space-y-6">
              {currentScene === 'choice' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">
                      Join a Neighborhood or Start Your Own
                    </h2>
                    <p className="text-slate-400">
                      Someone you follow has open properties in their neighborhood. You can join them or build your own street.
                    </p>
                  </div>

                  <div className="grid gap-4">
                    {followedNeighbors.map((neighbor) => (
                      <div
                        key={neighbor.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/80 p-5"
                      >
                        <div>
                          <p className="font-semibold text-white">{neighbor.username}</p>
                          <p className="text-sm text-slate-400">Has a neighborhood with open properties</p>
                        </div>
                        <Button
                          onClick={() => handleJoinNeighborhood(neighbor.id, neighbor.username)}
                          disabled={joiningNeighborhood}
                          className="bg-gradient-to-r from-cyan-500 to-blue-600"
                        >
                          {joiningNeighborhood ? 'Joining...' : `Join ${neighbor.username}'s Neighborhood`}
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-slate-700" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">or</span>
                    <div className="h-px flex-1 bg-slate-700" />
                  </div>

                  <Button
                    onClick={() => setCurrentScene('street')}
                    variant="secondary"
                    className="w-full"
                  >
                    Create Your Own Neighborhood
                  </Button>
                </div>
              )}
              {currentScene === 'street' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">
                      Create Your First Home in Mai Troll
                    </h2>
                    <p className="text-slate-400">
                      Choose a street name, zip, and the number of houses on your block.
                      Your house will be the hero home.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="streetName">Street / Neighborhood Name</Label>
                        <Input
                          id="streetName"
                          value={streetName}
                          onChange={(e) => setStreetName(e.target.value)}
                          placeholder="Neon Lane"
                        />
                      </div>

                      <div>
                        <Label htmlFor="zipCode">Zip Code</Label>
                        <Input
                          id="zipCode"
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                          placeholder="12345"
                        />
                      </div>

                      <div>
                        <Label htmlFor="houseCount">Number of Houses</Label>
                        <Input
                          id="houseCount"
                          type="number"
                          value={houseCount}
                          min={1}
                          max={15}
                          onChange={(e) =>
                            setHouseCount(Math.max(1, Math.min(15, Number(e.target.value))))
                          }
                          placeholder="5"
                        />
                        <p className="mt-2 text-xs text-slate-500">
                          Max 15 houses. The first house becomes your base.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-3xl border border-slate-700 bg-slate-950/80 p-5">
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-2 text-sm text-slate-200">
                        <MapPin className="h-4 w-4 text-cyan-300" />
                        Street Preview
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 text-sm text-slate-300">
                          <p className="font-semibold text-white">
                            {streetName || 'MaiTroll Lane'}
                          </p>
                          <p>
                            ZIP {zipCode || '00001'} • {houseCount} houses
                          </p>
                        </div>

                        {streetPreview()}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-4">
                      <div className="text-sm text-slate-400">House Type</div>
                      <Select value={houseStyle} onValueChange={setHouseStyle}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="House Style" />
                        </SelectTrigger>
                        <SelectContent>
                          {HOUSE_TYPES.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-4">
                      <div className="text-sm text-slate-400">Door Color</div>
                      <Select value={doorColor} onValueChange={setDoorColor}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Door Color" />
                        </SelectTrigger>
                        <SelectContent>
                          {DOOR_COLORS.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-4">
                      <div className="text-sm text-slate-400">Yard Decoration</div>
                      <Select value={yardDecoration} onValueChange={setYardDecoration}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Yard Style" />
                        </SelectTrigger>
                        <SelectContent>
                          {YARD_DECORATIONS.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handleCreateStreet}
                      disabled={creatingNeighborhood}
                      className="bg-gradient-to-r from-cyan-500 to-blue-600"
                    >
                      {creatingNeighborhood ? 'Creating street…' : 'Build My Street'}
                    </Button>

                    <Button variant="secondary" onClick={() => setCurrentScene('car')}>
                      Skip Setup
                    </Button>
                  </div>
                </div>
              )}

              {currentScene === 'car' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">Choose Your Car</h2>
                    <p className="text-slate-400">
                      Pick a starter vehicle and prepare to get your Mai Troll license.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {CAR_OPTIONS.map((car) => (
                      <button
                        key={car.id}
                        type="button"
                        onClick={() => setSelectedCarId(car.id)}
                        className={`group rounded-3xl border p-5 text-left transition ${
                          selectedCarId === car.id
                            ? 'border-violet-400 bg-violet-950/60 shadow-lg shadow-violet-500/10'
                            : 'border-slate-700 bg-slate-900/80 hover:border-slate-500'
                        }`}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <span className="text-sm uppercase tracking-[0.2em] text-slate-400">
                            {car.tier}
                          </span>
                          <Badge>{car.price} TC</Badge>
                        </div>

                        <div className="mb-3 text-lg font-semibold text-white">{car.name}</div>
                        <p className="text-sm text-slate-400">{car.description}</p>

                        <div className="mt-4 flex items-center gap-3 text-sm text-slate-300">
                          <span>Speed {car.speed}</span>
                          <span>Armor {car.armor}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      onClick={handlePurchaseCar}
                      disabled={purchasingCar}
                      className="bg-gradient-to-r from-orange-500 to-red-500"
                    >
                      {purchasingCar ? 'Buying ride…' : `Buy ${selectedCar.name}`}
                    </Button>

                    <Button variant="secondary" onClick={() => navigate('/ktauto')}>
                      More Cars at Dealership
                    </Button>
                  </div>
                </div>
              )}

              {currentScene === 'driverTest' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">
                      Get Your Mai Troll License
                    </h2>
                    <p className="text-slate-400">
                      The written driver test has been removed. Click the button below to
                      activate your Mai Troll license.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-cyan-500/30 bg-slate-950/90 p-6 shadow-lg shadow-cyan-950/30">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-sm font-semibold text-cyan-200">
                          <ShieldCheck className="h-4 w-4" />
                          Instant License Grant
                        </div>

                        <h3 className="mt-4 text-xl font-bold text-white">
                          Activate your driver status
                        </h3>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                          This saves your license to the backend, marks your driver status
                          active, and continues onboarding to insurance.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-300">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Current Status
                        </div>
                        <div className="mt-2 text-lg font-bold text-white">{driverStatus}</div>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm leading-6 text-slate-300">
                        Your license lets the neighborhood and vehicle system recognize you
                        as a valid driver.
                      </div>

                      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm leading-6 text-slate-300">
                        Officers and BroadOfficers may still check your license status later.
                      </div>

                      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm leading-6 text-slate-300">
                        Insurance, violations, and suspensions can still affect driving permissions.
                      </div>

                      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm leading-6 text-slate-300">
                        After this step, you will continue to insurance setup.
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <Button
                        onClick={handleGrantDriverLicense}
                        disabled={grantingLicense || licenseLoading}
                        className="bg-gradient-to-r from-green-500 to-emerald-500"
                      >
                        {grantingLicense || licenseLoading ? 'Granting License…' : 'Get License'}
                      </Button>

                      <Button variant="secondary" onClick={() => setCurrentScene('insurance')}>
                        Skip to Insurance
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {currentScene === 'insurance' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">Get Insurance</h2>
                    <p className="text-slate-400">
                      Insurance and a valid license are required to broadcast, drive, and access neighborhood features.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                    <p className="font-semibold">⚠️ Important</p>
                    <p className="mt-1">Car insurance must stay active to keep your vehicle protected. Home insurance (7 days) unlocks broadcast access and must be renewed before it expires. Your license must remain valid — if both insurances expire, your license will be suspended.</p>
                  </div>

                  <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                    <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
                      <div>
                        <p className="font-semibold text-white">Starter Car Coverage</p>
                        <p>30 days active coverage with deductible protection.</p>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-400">FREE</div>
                        <div className="text-xs text-emerald-400/70">
                          {hasFreeInsurance ? 'First coverage free' : 'Starter coverage'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handlePurchaseInsurance}
                      disabled={insuranceBuying}
                      className="bg-gradient-to-r from-emerald-500 to-green-500"
                    >
                      {insuranceBuying
                        ? 'Activating…'
                        : hasFreeInsurance
                          ? 'Get Free Car Insurance'
                          : 'Get Car Insurance'}
                    </Button>
                  </div>

                  <div className="border-t border-slate-700 pt-6">
                    <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                      <div className="flex items-center justify-between gap-4 text-sm text-slate-300">
                        <div>
                          <p className="font-semibold text-white">Homeowners Coverage</p>
                          <p>7 days active coverage. Required to unlock broadcast access.</p>
                        </div>

                        <div className="text-right">
                          <div className="text-2xl font-bold text-yellow-400">500 TC</div>
                          <div className="text-xs text-yellow-400/70">
                            {profile && (profile as any)?.troll_coins >= 500 ? 'You can afford this' : 'Not enough coins'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-300">
                      <p>Your balance: <span className="font-bold text-yellow-400">{(profile as any)?.troll_coins ?? 0} Troll Coins</span></p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handlePurchaseHomeInsurance}
                      disabled={homeInsuranceBuying || ((profile as any)?.troll_coins ?? 0) < 500}
                      className="bg-gradient-to-r from-yellow-500 to-amber-500"
                    >
                      {homeInsuranceBuying
                        ? 'Purchasing…'
                        : 'Buy Home Insurance (500 TC)'}
                    </Button>

                    <Button variant="secondary" onClick={() => setCurrentScene('license')}>
                      Skip for now
                    </Button>
                  </div>
                </div>
              )}

              {currentScene === 'license' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-semibold text-white">
                      Customize Your License Plate
                    </h2>
                    <p className="text-slate-400">
                      Your plate is your street identity. Use uppercase letters and numbers.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-4 rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                      <Label htmlFor="plateText">License Plate</Label>

                      <Input
                        id="plateText"
                        value={plateText}
                        onChange={(e) => setPlateText(e.target.value.toUpperCase())}
                        placeholder="TROLL123"
                        maxLength={8}
                      />

                      <div className="grid gap-2 text-sm text-slate-400">
                        <p>Allowed: letters and numbers only.</p>
                        <p>Max 8 characters.</p>
                        <p>
                          Current driver status:{' '}
                          <span className="text-slate-100">{driverStatus}</span>
                          {licenseExpiryDisplay && (
                            <span className="text-slate-100">
                              {' '}
                              (Expires: {new Date(licenseExpiryDisplay).toLocaleDateString()})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                      <div className="mb-3 text-sm uppercase tracking-[0.2em] text-slate-400">
                        Plate Preview
                      </div>

                      <div className="rounded-3xl border border-slate-600 bg-slate-900 p-4 text-center">
                        <div className="text-xl font-bold tracking-[0.3em] text-cyan-300">
                          Mai Troll
                        </div>
                        <div className="mt-4 text-4xl font-black tracking-[0.5em] text-white">
                          {plateText || 'XXXXXXX'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handleSavePlate}
                      disabled={updatingPlate}
                      className="bg-gradient-to-r from-cyan-500 to-blue-500"
                    >
                      {updatingPlate ? 'Saving…' : 'Save Plate & Finish'}
                    </Button>

                    <Button variant="secondary" onClick={() => setCurrentScene('complete')}>
                      Skip and enter neighborhood
                    </Button>
                  </div>
                </div>
              )}

              {currentScene === 'complete' && (
                <div className="space-y-6">
                  <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-6 text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
                      <Check className="h-10 w-10" />
                    </div>

                    <h2 className="text-3xl font-semibold text-white">Neighborhood Ready</h2>

                    <p className="mt-3 text-slate-400">
                      {completeMessage || 'Your street is complete. Welcome to the neighborhood!'}
                    </p>
                  </div>

                  {neighborhoodMapPreview()}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                      <h3 className="font-semibold text-white">Property Summary</h3>

                      <ul className="mt-4 space-y-2 text-sm text-slate-300">
                        <li>
                          <span className="text-slate-100">House Type:</span>{' '}
                          {selectedHouseConfig.houseType}
                        </li>
                        <li>
                          <span className="text-slate-100">Door:</span>{' '}
                          {selectedHouseConfig.doorColor}
                        </li>
                        <li>
                          <span className="text-slate-100">Trim:</span>{' '}
                          {selectedHouseConfig.trimColor}
                        </li>
                        <li>
                          <span className="text-slate-100">Windows:</span>{' '}
                          {selectedHouseConfig.windowStyle}
                        </li>
                        <li>
                          <span className="text-slate-100">Roof:</span>{' '}
                          {selectedHouseConfig.roofStyle}
                        </li>
                        <li>
                          <span className="text-slate-100">Yard:</span>{' '}
                          {selectedHouseConfig.yardDecoration}
                        </li>
                      </ul>
                    </div>

                    <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-5">
                      <h3 className="font-semibold text-white">Final Stats</h3>

                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        <div className="flex items-center justify-between">
                          <span>Street</span>
                          <span>{streetName}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span>ZIP</span>
                          <span>{zipCode}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span>Houses</span>
                          <span>{houseCount}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span>Vehicle</span>
                          <span>{selectedCar.name}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span>License</span>
                          <span>
                            {driverStatus}
                            {licenseExpiryDisplay
                              ? ` (Expires: ${new Date(
                                  licenseExpiryDisplay
                                ).toLocaleDateString()})`
                              : ''}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span>Insurance</span>
                          <span>{insuranceStatusDisplay}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3">
                    <Button
                      onClick={() => navigate('/neighborhood-map')}
                      className="bg-gradient-to-r from-blue-500 to-cyan-500"
                    >
                      Explore the Map
                    </Button>

                    <Button variant="secondary" onClick={() => navigate('/ktauto')}>
                      Polish Your Ride
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <aside className="space-y-6 rounded-3xl border border-slate-700 bg-slate-950/90 p-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Neighborhood Bonus</span>
                  <Badge>NEW</Badge>
                </div>

                <p className="mt-3 text-slate-400">
                  Complete the onboarding to unlock a street map, family slots, driver
                  status, and house upgrades.
                </p>
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                <div className="text-sm uppercase tracking-[0.24em] text-slate-500">
                  Your House Build
                </div>

                <div className="grid gap-2">
                  <Badge variant="secondary">
                    {HOUSE_TYPES.find((item) => item.id === houseStyle)?.label}
                  </Badge>
                  <Badge variant="secondary">
                    Door {DOOR_COLORS.find((item) => item.id === doorColor)?.label}
                  </Badge>
                  <Badge variant="secondary">
                    Roof {ROOF_STYLES.find((item) => item.id === roofStyle)?.label}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-cyan-300" />
                  <span>Driver Status</span>
                </div>

                <div className="text-2xl font-semibold text-white">{driverStatus}</div>

                <div className="text-sm text-slate-400">
                  Your license is the key to safe car upgrades and future raids.
                </div>
              </div>
            </aside>
          </CardContent>
        </Card>
      </div>

      {showSceneCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative text-center">
            <div className="absolute inset-0 -z-10">
              {[...Array(20)].map((_, index) => (
                <Sparkles
                  key={index}
                  className="absolute animate-pulse text-yellow-400"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${1 + Math.random() * 2}s`,
                  }}
                  size={16 + Math.random() * 16}
                />
              ))}
            </div>

            <div className="rounded-3xl border border-yellow-400/30 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 p-8 shadow-2xl">
              <div className="mb-4 flex justify-center">
                <div className="relative">
                  <Trophy className="h-16 w-16 animate-bounce text-yellow-400" />
                  <Zap className="absolute -right-2 -top-2 h-6 w-6 animate-pulse text-orange-400" />
                  <Star className="absolute -bottom-1 -left-1 h-5 w-5 animate-spin text-yellow-300" />
                </div>
              </div>

              <h3 className="mb-2 text-2xl font-bold text-white">Level Up!</h3>
              <p className="text-lg text-yellow-200">{celebrationMessage}</p>
            </div>
          </div>
        </div>
      )}

      {sceneTransitioning && !showSceneCelebration && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
            <p className="text-lg text-cyan-300">Transitioning to next scene...</p>
          </div>
        </div>
      )}

      <Dialog
        open={showSetupReminder}
        onOpenChange={(open) => {
          setShowSetupReminder(open)

          if (!open) {
            localStorage.setItem('tc_neighborhood_setup_reminder_seen', 'true')
            localStorage.setItem('tc_neighborhood_test_reminder_seen', 'true')
          }
        }}
      >
        <DialogContent className="border-violet-500/30 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <Sparkles className="h-5 w-5 text-violet-400" />
              Complete Your Neighborhood Setup
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-slate-300">
            <p>
              Welcome to Mai Troll! Before you can go{' '}
              <strong className="text-white">live</strong>, you need to:
            </p>

            <ol className="ml-1 list-inside list-decimal space-y-1.5">
              <li>Create your street and home</li>
              <li>Choose your vehicle</li>
              <li className="font-semibold text-cyan-300">Get your driver license</li>
              <li>Get insurance</li>
              <li>Register your license plate</li>
            </ol>

            <p className="text-xs text-slate-400">
              Complete this onboarding to unlock broadcasting, driving, and all
              neighborhood features.
            </p>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowSetupReminder(false)
                localStorage.setItem('tc_neighborhood_setup_reminder_seen', 'true')
                localStorage.setItem('tc_neighborhood_test_reminder_seen', 'true')
              }}
              className="w-full bg-gradient-to-r from-violet-500 to-purple-500"
            >
              Start Setup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
