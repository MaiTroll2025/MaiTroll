import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Building,
  Calculator,
  CheckCircle,
  CreditCard,
  Droplets,
  Edit2,
  FileText,
  Home,
  Hotel,
  Key,
  Landmark,
  Loader2,
  Tent,
  Trash2,
  UserMinus,
  Users,
  Warehouse,
  X,
  Zap,
} from 'lucide-react'

import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'

type TabKey = 'my_home' | 'my_lease' | 'my_loans' | 'market' | 'landlord' | 'tenants'
type LandlordSubTab = 'properties' | 'tenants' | 'applications'
type MarketFilter = 'rent' | 'sale'

interface Property {
  id: string
  name: string
  type_id?: string
  type?: string
  neighborhood_id?: string | null
  house_id?: string | null
  address?: string | null
  rent_amount: number
  utility_cost?: number | null
  electric_cost?: number | null
  water_cost?: number | null
  owner_id?: string | null
  owner_user_id?: string | null
  is_for_rent?: boolean
  is_for_sale?: boolean
  price: number
  last_rent_change_at?: string | null
  description?: string | null
  image_url?: string | null
  amenities?: string[] | null
  is_admin_created?: boolean
  is_landlord_purchased?: boolean
  max_tenants?: number | null
  current_tenants?: number | null
  occupancy?: number
  owner?: { username?: string | null } | null
}

interface Lease {
  id: string
  property_id: string
  property: Property
  tenant_id: string
  start_date: string
  rent_due_day: number
  last_rent_paid_at: string | null
  last_utility_paid_at?: string | null
  status: string
}

interface HouseRental {
  id: string
  landlord_user_id: string
  tenant_user_id: string
  user_house_id: string
  rent_amount: number
  status: string
  last_paid_at: string | null
  next_due_at: string | null
  house_name?: string
}

interface LandlordLoan {
  id: string
  user_id: string
  property_id?: string
  property?: Property
  amount?: number
  loan_amount?: number
  remaining_balance: number
  monthly_payment?: number
  status: 'active' | 'paid' | 'defaulted'
  created_at: string
}

interface LandlordApplication {
  id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
  business_plan: string
  experience_years: number
  has_startup_capital: boolean
  created_at: string
}

interface TenantLease {
  id: string
  property_id: string
  tenant_id: string
  start_date: string
  rent_due_day: number
  last_rent_paid_at: string | null
  last_utility_paid_at: string | null
  status: string
  created_at: string
  tenant_username: string
  property_name: string
  property_type: string
  rent_amount: number
  electric_cost: number
  water_cost: number
  is_overdue: boolean
  has_lease?: boolean
}

interface RentalApplication {
  id: string
  property_id: string
  applicant_id: string
  status: 'pending' | 'approved' | 'rejected'
  message: string | null
  created_at: string
  applicant_username?: string
  applicant_credit_score?: number
  applicant_jail_count?: number
  property_name?: string
  property_rent?: number
}

const tcPage =
  'relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#050714] px-4 pb-10 pt-24 text-white md:px-8'
const tcPanel =
  'rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const tcCard =
  'rounded-2xl border border-cyan-300/15 bg-slate-950/65 text-white shadow-[0_0_30px_rgba(34,211,238,0.08)] backdrop-blur-xl'
const tcInput =
  'w-full rounded-xl border border-cyan-300/20 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/45 focus:ring-2 focus:ring-cyan-300/15'
const tcPrimary =
  'rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-2 font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45'
const tcSecondary =
  'rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 font-bold text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-45'
const tcDanger =
  'rounded-xl border border-red-300/25 bg-red-500/15 px-4 py-2 font-bold text-red-100 transition hover:bg-red-500/25'

const currency = (value?: number | null) => Number(value || 0).toLocaleString()

const getNextMonthlyRentDueDate = (
  dueDay: number,
  lastPaidAt?: string | null,
  startDate?: string | null
) => {
  const anchor = lastPaidAt ? new Date(lastPaidAt) : startDate ? new Date(startDate) : new Date()
  const now = new Date()
  const day = Math.max(1, Math.min(dueDay || 1, new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()))

  let due = new Date(anchor.getFullYear(), anchor.getMonth(), day, 12, 0, 0, 0)

  if (lastPaidAt || due < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    const nextMonth = new Date(due.getFullYear(), due.getMonth() + 1, 1)
    const nextDay = Math.max(
      1,
      Math.min(dueDay || 1, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate())
    )
    due = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextDay, 12, 0, 0, 0)
  }

  return due
}

const isTodayOrPast = (date: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const value = new Date(date)
  value.setHours(0, 0, 0, 0)

  return value <= today
}

const formatDueDate = (date: Date) =>
  date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

function getPropertyOwnerId(property: Property) {
  return property.owner_id || property.owner_user_id || null
}

function getElectric(property?: Property | null) {
  if (!property) return 0
  return Number(property.electric_cost ?? Math.ceil(Number(property.utility_cost || 0) / 2))
}

function getWater(property?: Property | null) {
  if (!property) return 0
  return Number(property.water_cost ?? Math.floor(Number(property.utility_cost || 0) / 2))
}

function getType(property?: Property | null) {
  return property?.type_id || property?.type || 'house'
}

function PropertyIcon({ type }: { type?: string }) {
  switch (type) {
    case 'mansion':
      return <Hotel className="h-6 w-6 text-amber-300" />
    case 'apartment':
      return <Building className="h-6 w-6 text-emerald-300" />
    case 'trailer':
      return <Warehouse className="h-6 w-6 text-orange-300" />
    case 'lot':
      return <Tent className="h-6 w-6 text-slate-300" />
    default:
      return <Home className="h-6 w-6 text-cyan-300" />
  }
}

export default function LivingPage() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<TabKey>('my_home')
  const [landlordSubTab, setLandlordSubTab] = useState<LandlordSubTab>('properties')
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('rent')

  const [loading, setLoading] = useState(false)
  const [loadingTenants, setLoadingTenants] = useState(false)

  const [myNeighborhood, setMyNeighborhood] = useState<any>(null)
  const [myHouse, setMyHouse] = useState<any>(null)
  const [neighborhoodHouses, setNeighborhoodHouses] = useState<any[]>([])

  const [myLease, setMyLease] = useState<Lease | null>(null)
  const [myHouseRental, setMyHouseRental] = useState<HouseRental | null>(null)
  const [myLoans, setMyLoans] = useState<LandlordLoan[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [ownedProperties, setOwnedProperties] = useState<Property[]>([])
  const [allTenants, setAllTenants] = useState<TenantLease[]>([])
  const [pendingApplications, setPendingApplications] = useState<RentalApplication[]>([])
  const [myApplications, setMyApplications] = useState<RentalApplication[]>([])

  const [isAdmin, setIsAdmin] = useState(false)
  const [isLandlord, setIsLandlord] = useState(false)
  const [landlordApplication, setLandlordApplication] = useState<LandlordApplication | null>(null)
  const [creditScore, setCreditScore] = useState(0)

  const [showLandlordApplication, setShowLandlordApplication] = useState(false)
  const [showAdminCreateProperty, setShowAdminCreateProperty] = useState(false)
  const [showLoanApplication, setShowLoanApplication] = useState(false)

  const [buyingProp, setBuyingProp] = useState<Property | null>(null)
  const [applyingToProp, setApplyingToProp] = useState<Property | null>(null)
  const [applicationMessage, setApplicationMessage] = useState('')

  const [editingProp, setEditingProp] = useState<Property | null>(null)
  const [editName, setEditName] = useState('')
  const [editRent, setEditRent] = useState('')
  const [editSalePrice, setEditSalePrice] = useState('')
  const [editIsForSale, setEditIsForSale] = useState(false)
  const [editIsForRent, setEditIsForRent] = useState(false)
  const [editMaxTenants, setEditMaxTenants] = useState(1)

  const [useLoan, setUseLoan] = useState(false)

  const [landlordAppForm, setLandlordAppForm] = useState({
    business_plan: '',
    experience_years: 0,
    has_startup_capital: false,
    loan_amount_needed: 0,
    property_value_interest: 0,
  })

  const [loanAppForm, setLoanAppForm] = useState({
    property_value: 0,
    loan_amount: 0,
    down_payment: 0,
    property_address: '',
    property_type: 'house',
  })

  const [adminPropertyForm, setAdminPropertyForm] = useState({
    name: '',
    type_id: 'house',
    rent_amount: 1500,
    price: 15000,
    bedrooms: 1,
    bathrooms: 1,
    sqft: 500,
    electric_cost: 75,
    water_cost: 75,
    description: '',
    max_tenants: 1,
  })

  const adminStatus = useMemo(() => {
    return profile?.role === 'admin' || profile?.role === 'ceo' || profile?.is_admin === true
  }, [profile])

  const neighborhoodId = profile?.neighborhood_id || myNeighborhood?.id || null
  const houseId = profile?.house_id || myHouse?.id || null

  useEffect(() => {
    setIsAdmin(adminStatus)
    if (adminStatus) setIsLandlord(true)
  }, [adminStatus])

  const fetchNeighborhoodContext = useCallback(async () => {
    if (!user?.id) return

    const { data: freshProfile } = await supabase
      .from('user_profiles')
      .select('id, neighborhood_id, house_id, is_landlord, credit_score')
      .eq('id', user.id)
      .maybeSingle()

    const resolvedNeighborhoodId = freshProfile?.neighborhood_id || profile?.neighborhood_id || null
    const resolvedHouseId = freshProfile?.house_id || profile?.house_id || null

    if (!resolvedNeighborhoodId && !resolvedHouseId) {
      navigate('/neighborhood-setup')
      return
    }

    if (freshProfile?.credit_score) setCreditScore(freshProfile.credit_score)
    if (freshProfile?.is_landlord && !adminStatus) setIsLandlord(true)

    if (resolvedNeighborhoodId) {
      const { data: neighborhood } = await supabase
        .from('neighborhoods')
        .select('*')
        .eq('id', resolvedNeighborhoodId)
        .maybeSingle()

      setMyNeighborhood(neighborhood || null)

      const { data: houses } = await supabase
        .from('houses')
        .select('*, neighborhoods(name, zip_code), owner:user_profiles!houses_owner_user_id_fkey(username)')
        .eq('neighborhood_id', resolvedNeighborhoodId)
        .order('created_at', { ascending: false })

      setNeighborhoodHouses(houses || [])
    }

    if (resolvedHouseId) {
      const { data: house } = await supabase
        .from('houses')
        .select('*, neighborhoods(name, zip_code), owner:user_profiles!houses_owner_user_id_fkey(username)')
        .eq('id', resolvedHouseId)
        .maybeSingle()

      setMyHouse(house || null)
    }
  }, [user?.id, profile?.neighborhood_id, profile?.house_id, navigate, adminStatus])

  const checkLandlordStatus = useCallback(async () => {
    if (!user?.id) return

    if (adminStatus) {
      setIsLandlord(true)
      return
    }

    const { data } = await supabase
      .from('user_profiles')
      .select('is_landlord')
      .eq('id', user.id)
      .maybeSingle()

    setIsLandlord(Boolean(data?.is_landlord))

    const { data: appData } = await supabase
      .from('landlord_applications')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    setLandlordApplication(appData || null)
  }, [user?.id, adminStatus])

  const fetchMyLease = useCallback(async () => {
    if (!user?.id) return

    const { data } = await supabase
      .from('leases')
      .select('*, property:properties(*)')
      .eq('tenant_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    setMyLease(data || null)
  }, [user?.id])

  const fetchMyHouseRental = useCallback(async () => {
    if (!user?.id) return

    const { data } = await supabase
      .from('house_rentals')
      .select('*, user_house:user_houses(house_catalog_id, catalog:houses_catalog(name))')
      .eq('tenant_user_id', user.id)
      .in('status', ['active', 'late'])
      .maybeSingle()

    setMyHouseRental(
      data
        ? {
            ...data,
            house_name: data.user_house?.catalog?.[0]?.name || 'Rental Property',
          }
        : null
    )
  }, [user?.id])

  const fetchMyApplications = useCallback(async () => {
    if (!user?.id) return

    const { data: apps } = await supabase
      .from('apartment_applications')
      .select('*')
      .eq('applicant_id', user.id)
      .order('created_at', { ascending: false })

    if (!apps?.length) {
      setMyApplications([])
      return
    }

    const enriched = await Promise.all(
      apps.map(async (app) => {
        const { data: prop } = await supabase
          .from('properties')
          .select('name, rent_amount')
          .eq('id', app.property_id)
          .maybeSingle()

        return {
          ...app,
          property_name: prop?.name || 'Unknown',
          property_rent: prop?.rent_amount || 0,
        }
      })
    )

    setMyApplications(enriched)
  }, [user?.id])

  const fetchOwnedProperties = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)

    const { data: props } = await supabase
      .from('properties')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (!props?.length) {
      setOwnedProperties([])
      setLoading(false)
      return
    }

    const propsWithOccupancy = await Promise.all(
      props.map(async (property) => {
        const { count } = await supabase
          .from('leases')
          .select('*', { count: 'exact', head: true })
          .eq('property_id', property.id)
          .eq('status', 'active')

        return {
          ...property,
          occupancy: count || 0,
          max_tenants: property.max_tenants || 1,
        }
      })
    )

    setOwnedProperties(propsWithOccupancy)
    setLoading(false)
  }, [user?.id])

  const fetchMyLoans = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)

    const { data } = await supabase
      .from('bank_loans')
      .select('*, property:properties(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    setMyLoans(
      (data || []).map((loan: any) => ({
        ...loan,
        loan_amount: loan.amount || loan.loan_amount,
        monthly_payment: loan.monthly_payment || Math.ceil(Number(loan.amount || loan.loan_amount || 0) / 50),
      }))
    )

    setLoading(false)
  }, [user?.id])

  const fetchMarket = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)

    try {
      let query = supabase.from('properties').select('*').limit(150)

      if (marketFilter === 'sale') {
        query = query.eq('is_for_sale', true)
      } else {
        query = query.eq('is_for_rent', true)
      }

      if (neighborhoodId) {
        query = query.or(`neighborhood_id.eq.${neighborhoodId},neighborhood_id.is.null`)
      }

      const { data, error } = await query

      if (error) throw error

      const rows = data || []

      const withDetails = await Promise.all(
        rows.map(async (property: Property) => {
          const ownerId = getPropertyOwnerId(property)

          let owner = null
          if (ownerId) {
            const { data: ownerProfile } = await supabase
              .from('user_profiles')
              .select('username')
              .eq('id', ownerId)
              .maybeSingle()

            owner = ownerProfile
          }

          const { count } = await supabase
            .from('leases')
            .select('*', { count: 'exact', head: true })
            .eq('property_id', property.id)
            .eq('status', 'active')

          return {
            ...property,
            owner,
            occupancy: count || 0,
            max_tenants: property.max_tenants || 1,
          }
        })
      )

      setProperties(
        withDetails.filter((property) => {
          const ownerId = getPropertyOwnerId(property)
          if (ownerId === user.id && !adminStatus) return false
          if (marketFilter === 'rent' && property.occupancy! >= Number(property.max_tenants || 1)) return false
          return true
        })
      )
    } catch (error: any) {
      console.error('Error fetching market:', error)
      toast.error('Failed to load housing market')
      setProperties([])
    } finally {
      setLoading(false)
    }
  }, [user?.id, marketFilter, neighborhoodId, adminStatus])

  const fetchAllTenants = useCallback(async () => {
    if (!user?.id) return

    setLoadingTenants(true)

    try {
      const { data: ownedProps } = await supabase
        .from('properties')
        .select('id, name, type_id, rent_amount, electric_cost, water_cost, utility_cost')
        .eq('owner_id', user.id)

      if (!ownedProps?.length) {
        setAllTenants([])
        setLoadingTenants(false)
        return
      }

      const propIds = ownedProps.map((property) => property.id)
      const propMap = new Map(ownedProps.map((property) => [property.id, property]))

      const { data: leases } = await supabase
        .from('leases')
        .select('*')
        .in('property_id', propIds)
        .eq('status', 'active')

      const tenantLeases: TenantLease[] = []

      if (leases?.length) {
        const tenantIds = [...new Set(leases.map((lease) => lease.tenant_id))]
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username')
          .in('id', tenantIds)

        const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]))

        for (const lease of leases) {
          const prop = propMap.get(lease.property_id)
          const tenant = profileMap.get(lease.tenant_id)
          const lastPaid = lease.last_rent_paid_at ? new Date(lease.last_rent_paid_at) : null
          const daysSincePayment = lastPaid
            ? (Date.now() - lastPaid.getTime()) / (1000 * 60 * 60 * 24)
            : 999

          tenantLeases.push({
            id: lease.id,
            property_id: lease.property_id,
            tenant_id: lease.tenant_id,
            start_date: lease.start_date,
            rent_due_day: lease.rent_due_day,
            last_rent_paid_at: lease.last_rent_paid_at,
            last_utility_paid_at: lease.last_utility_paid_at,
            status: lease.status,
            created_at: lease.created_at,
            tenant_username: tenant?.username || 'Unknown',
            property_name: prop?.name || 'Unknown Property',
            property_type: prop?.type_id || 'apartment',
            rent_amount: prop?.rent_amount || 0,
            electric_cost: prop?.electric_cost ?? Math.ceil((prop?.utility_cost || 0) / 2),
            water_cost: prop?.water_cost ?? Math.floor((prop?.utility_cost || 0) / 2),
            is_overdue: daysSincePayment > 30,
            has_lease: true,
          })
        }
      }

      setAllTenants(tenantLeases)
    } catch (error) {
      console.error('Error fetching tenants:', error)
      toast.error('Failed to load tenants')
    } finally {
      setLoadingTenants(false)
    }
  }, [user?.id])

  const fetchPendingApplications = useCallback(async () => {
    if (!user?.id) return

    const { data: ownedProps } = await supabase
      .from('properties')
      .select('id, name, rent_amount')
      .eq('owner_id', user.id)

    if (!ownedProps?.length) {
      setPendingApplications([])
      return
    }

    const propIds = ownedProps.map((property) => property.id)
    const propMap = new Map(ownedProps.map((property) => [property.id, property]))

    const { data: apps } = await supabase
      .from('apartment_applications')
      .select('*')
      .in('property_id', propIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (!apps?.length) {
      setPendingApplications([])
      return
    }

    const enriched = await Promise.all(
      apps.map(async (app) => {
        const prop = propMap.get(app.property_id)

        const { data: applicant } = await supabase
          .from('user_profiles')
          .select('username, credit_score')
          .eq('id', app.applicant_id)
          .maybeSingle()

        const { count: jailCount } = await supabase
          .from('jail')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', app.applicant_id)

        return {
          ...app,
          applicant_username: applicant?.username || 'Unknown',
          applicant_credit_score: applicant?.credit_score || 400,
          applicant_jail_count: jailCount || 0,
          property_name: prop?.name || 'Unknown',
          property_rent: prop?.rent_amount || 0,
        }
      })
    )

    setPendingApplications(enriched)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    void fetchNeighborhoodContext()
    void checkLandlordStatus()
    void fetchMyLease()
    void fetchMyHouseRental()
    void fetchMyApplications()
    void fetchMyLoans()
  }, [
    user?.id,
    fetchNeighborhoodContext,
    checkLandlordStatus,
    fetchMyLease,
    fetchMyHouseRental,
    fetchMyApplications,
    fetchMyLoans,
  ])

  useEffect(() => {
    if (activeTab === 'market') void fetchMarket()
    if (activeTab === 'landlord') void fetchOwnedProperties()
    if (activeTab === 'tenants') {
      void fetchAllTenants()
      void fetchPendingApplications()
    }
  }, [activeTab, marketFilter, fetchMarket, fetchOwnedProperties, fetchAllTenants, fetchPendingApplications])

  const handleSubmitLandlordApplication = async () => {
    if (!user?.id) return

    if (!landlordAppForm.business_plan.trim()) {
      toast.error('Please enter your landlord business plan')
      return
    }

    if (useLoan && creditScore <= 650) {
      toast.error('Credit score must be above 650 for instant mortgage approval')
      return
    }

    try {
      const { data, error } = await supabase.rpc('purchase_landlord_license', {
        p_use_loan: useLoan,
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error || data.message || 'Application denied')

      await supabase.from('landlord_applications').insert({
        user_id: user.id,
        status: 'approved',
        business_plan: landlordAppForm.business_plan,
        experience_years: landlordAppForm.experience_years,
        has_startup_capital: landlordAppForm.has_startup_capital,
        loan_amount_needed: landlordAppForm.loan_amount_needed,
        property_value_interest: landlordAppForm.property_value_interest,
      })

      setIsLandlord(true)
      setShowLandlordApplication(false)
      setUseLoan(false)
      toast.success('Landlord license approved')
      setActiveTab('market')
      setMarketFilter('sale')
    } catch (error: any) {
      toast.error(error.message || 'Landlord application failed')
    }
  }

  const handleAdminCreateProperty = async () => {
    if (!isAdmin || !user?.id) return

    if (!adminPropertyForm.name.trim()) {
      toast.error('Property name required')
      return
    }

    try {
      const isApartment = adminPropertyForm.type_id === 'apartment'

      const { error } = await supabase.from('properties').insert({
        name: adminPropertyForm.name,
        type_id: adminPropertyForm.type_id,
        neighborhood_id: neighborhoodId,
        rent_amount: adminPropertyForm.rent_amount,
        price: adminPropertyForm.price,
        bedrooms: adminPropertyForm.bedrooms,
        bathrooms: adminPropertyForm.bathrooms,
        sqft: adminPropertyForm.sqft,
        electric_cost: adminPropertyForm.electric_cost,
        water_cost: adminPropertyForm.water_cost,
        is_for_sale: !isApartment,
        is_for_rent: isApartment,
        is_admin_created: true,
        is_landlord_purchased: false,
        owner_id: null,
        tenant_capacity: adminPropertyForm.max_tenants,
        max_tenants: adminPropertyForm.max_tenants,
        current_tenants: 0,
        amenities: ['Basic Amenities'],
        description:
          adminPropertyForm.description ||
          (isApartment ? 'A Mai Troll property available for rent.' : 'A Mai Troll property available for sale.'),
        image_url: '/api/placeholder/400/300',
      })

      if (error) throw error

      toast.success('Property created')
      setShowAdminCreateProperty(false)
      setActiveTab('market')
      setMarketFilter(isApartment ? 'rent' : 'sale')
      void fetchMarket()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create property')
    }
  }

  const handleBuyWithLoan = async () => {
    if (!buyingProp || !user?.id || !profile) return

    if ((profile.level || 0) < 30 && !isAdmin) {
      toast.error(`You must be level 30 to buy property. Current: Level ${profile.level || 0}`)
      return
    }

    const downPayment = Math.ceil(Number(buyingProp.price || 0) * 0.1)

    try {
      const { data, error } = await supabase.rpc('buy_property_with_loan', {
        p_property_id: buyingProp.id,
        p_down_payment: downPayment,
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error || 'Purchase failed')

      toast.success('Property purchased with loan')
      setBuyingProp(null)
      setIsLandlord(true)
      setActiveTab('landlord')
      void fetchOwnedProperties()
      void fetchMyLoans()
      void fetchMarket()
    } catch (error: any) {
      toast.error(error.message || 'Purchase failed')
    }
  }

  const handlePayLoan = async (loan: LandlordLoan) => {
    const amount = prompt(
      `Pay mortgage? Remaining: ${currency(loan.remaining_balance)} coins`,
      String(loan.monthly_payment || 0)
    )

    if (!amount) return

    const payAmount = Number(amount)
    if (!Number.isFinite(payAmount) || payAmount <= 0) return

    try {
      const { data, error } = await supabase.rpc('pay_bank_loan', {
        p_loan_id: loan.id,
        p_amount: payAmount,
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error || 'Payment failed')

      toast.success(`Paid ${currency(payAmount)} coins`)
      void fetchMyLoans()
    } catch (error: any) {
      toast.error(error.message || 'Payment failed')
    }
  }

  const handleRent = async (property: Property) => {
    if (!user?.id) return

    const total = Number(property.rent_amount || 0) + getElectric(property) + getWater(property)

    if (!confirm(`Rent ${property.name}? Initial cost: ${currency(total)} coins`)) return

    try {
      const { data, error } = await supabase.rpc('sign_lease', {
        p_property_id: property.id,
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error || 'Lease failed')

      await supabase
        .from('user_profiles')
        .update({
          housing_status: 'rented',
          home_type: getType(property),
          neighborhood_id: property.neighborhood_id || neighborhoodId,
        })
        .eq('id', user.id)

      toast.success('Welcome home')
      setActiveTab('my_home')
      void fetchMyLease()
      void fetchNeighborhoodContext()
      void fetchMarket()
    } catch (error: any) {
      toast.error(error.message || 'Could not rent property')
    }
  }

  const handleApplyForRental = async () => {
    if (!user?.id || !applyingToProp) return

    if (myLease) {
      toast.error('You already have an active lease')
      return
    }

    const fee = 35

    if (Number(profile?.troll_coins || 0) < fee) {
      toast.error(`Application fee is ${fee} TC`)
      return
    }

    try {
      await supabase
        .from('user_profiles')
        .update({ troll_coins: Number(profile?.troll_coins || 0) - fee })
        .eq('id', user.id)

      const { error } = await supabase.from('apartment_applications').insert({
        property_id: applyingToProp.id,
        applicant_id: user.id,
        status: 'pending',
        message: applicationMessage || null,
      })

      if (error) throw error

      toast.success('Application submitted')
      setApplyingToProp(null)
      setApplicationMessage('')
      void fetchMyApplications()
    } catch (error: any) {
      toast.error(error.message || 'Application failed')
    }
  }

  const handleApproveApplication = async (application: RentalApplication) => {
    if (!confirm(`Approve ${application.applicant_username}?`)) return

    try {
      await supabase.from('apartment_applications').update({ status: 'approved' }).eq('id', application.id)

      const { data, error } = await supabase.rpc('sign_lease_for_applicant', {
        p_property_id: application.property_id,
        p_applicant_id: application.applicant_id,
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error || 'Lease creation failed')

      toast.success('Application approved and lease created')
      void fetchPendingApplications()
      void fetchAllTenants()
      void fetchOwnedProperties()
    } catch (error: any) {
      toast.error(error.message || 'Approval failed')
    }
  }

  const handleDenyApplication = async (application: RentalApplication) => {
    if (!confirm(`Deny ${application.applicant_username}?`)) return

    await supabase.from('apartment_applications').update({ status: 'rejected' }).eq('id', application.id)

    toast.success('Application denied')
    void fetchPendingApplications()
  }

  const handlePayRent = async () => {
    if (!myLease) return

    const nextDue = getNextMonthlyRentDueDate(
      myLease.rent_due_day,
      myLease.last_rent_paid_at,
      myLease.start_date
    )

    if (!isTodayOrPast(nextDue)) {
      toast.error(`Rent is not due until ${formatDueDate(nextDue)}`)
      return
    }

    const total = Number(myLease.property.rent_amount || 0) + getElectric(myLease.property) + getWater(myLease.property)

    if (!confirm(`Pay rent and utilities? Total: ${currency(total)} coins`)) return

    try {
      const { data, error } = await supabase.rpc('pay_rent', {
        p_lease_id: myLease.id,
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error || 'Payment failed')

      toast.success('Rent paid')
      void fetchMyLease()
    } catch (error: any) {
      toast.error(error.message || 'Payment failed')
    }
  }

  const handlePayHouseRent = async () => {
    if (!myHouseRental) return

    if (myHouseRental.next_due_at && new Date(myHouseRental.next_due_at) > new Date()) {
      toast.error(`Rent is not due until ${formatDueDate(new Date(myHouseRental.next_due_at))}`)
      return
    }

    if (!confirm(`Pay house rent? Total: ${currency(myHouseRental.rent_amount)} coins`)) return

    try {
      const { data, error } = await supabase.rpc('pay_house_rent', {
        p_rental_id: myHouseRental.id,
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error || 'Payment failed')

      toast.success('House rent paid')
      void fetchMyHouseRental()
    } catch (error: any) {
      toast.error(error.message || 'Payment failed')
    }
  }

  const handleCollectRent = async (lease: TenantLease) => {
    const total = lease.rent_amount + lease.electric_cost + lease.water_cost

    if (!confirm(`Collect ${currency(total)} coins from ${lease.tenant_username}?`)) return

    try {
      const { data, error } = await supabase.rpc(lease.has_lease ? 'collect_rent' : 'collect_house_rent', {
        [lease.has_lease ? 'p_lease_id' : 'p_rental_id']: lease.id,
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error || 'Collection failed')

      toast.success('Rent collected')
      void fetchAllTenants()
      void fetchOwnedProperties()
    } catch (error: any) {
      toast.error(error.message || 'Collection failed')
    }
  }

  const handleEvictTenant = async (lease: TenantLease) => {
    if (!confirm(`Evict ${lease.tenant_username}? This will affect their credit.`)) return

    try {
      const { data, error } = await supabase.rpc('evict_tenant', {
        p_lease_id: lease.id,
      })

      if (error) throw error
      if (data && !data.success) throw new Error(data.error || 'Eviction failed')

      toast.success('Tenant evicted')
      void fetchAllTenants()
      void fetchOwnedProperties()
    } catch (error: any) {
      toast.error(error.message || 'Eviction failed')
    }
  }

  const handleUpdateProperty = async () => {
    if (!editingProp) return

    const rent = Number(editRent)
    const price = Number(editSalePrice)

    if (!Number.isFinite(rent) || rent < 0) {
      toast.error('Invalid rent amount')
      return
    }

    if (editIsForSale && (!Number.isFinite(price) || price <= 0)) {
      toast.error('Invalid sale price')
      return
    }

    try {
      const { error } = await supabase
        .from('properties')
        .update({
          name: editName,
          rent_amount: rent,
          is_for_rent: editIsForRent,
          is_for_sale: editIsForSale,
          price: editIsForSale ? price : editingProp.price,
          max_tenants: editMaxTenants,
          last_rent_change_at:
            rent !== editingProp.rent_amount ? new Date().toISOString() : editingProp.last_rent_change_at,
        })
        .eq('id', editingProp.id)

      if (error) throw error

      toast.success('Property updated')
      setEditingProp(null)
      void fetchOwnedProperties()
      void fetchMarket()
    } catch (error: any) {
      toast.error(error.message || 'Update failed')
    }
  }

  const handleDeleteProperty = async (propertyId: string) => {
    if (!isAdmin) return
    if (!confirm('Delete this property?')) return

    const { error } = await supabase.from('properties').delete().eq('id', propertyId)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Property deleted')
    void fetchMarket()
  }

  const myLeaseNextDue = myLease
    ? getNextMonthlyRentDueDate(myLease.rent_due_day, myLease.last_rent_paid_at, myLease.start_date)
    : null

  const canPayLeaseRent = Boolean(myLeaseNextDue && isTodayOrPast(myLeaseNextDue))
  const houseRentNextDue = myHouseRental?.next_due_at ? new Date(myHouseRental.next_due_at) : null
  const canPayHouseRent = !houseRentNextDue || houseRentNextDue <= new Date()

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode; hidden?: boolean }> = [
    { key: 'my_home', label: 'My Home', icon: <Home className="h-4 w-4" /> },
    { key: 'my_lease', label: 'Lease', icon: <FileText className="h-4 w-4" /> },
    { key: 'my_loans', label: 'Mortgages', icon: <Landmark className="h-4 w-4" /> },
    { key: 'market', label: 'Find Home', icon: <Key className="h-4 w-4" /> },
    { key: 'landlord', label: 'Landlord', icon: <Building className="h-4 w-4" /> },
    { key: 'tenants', label: 'Tenants', icon: <Users className="h-4 w-4" />, hidden: !isLandlord },
  ]

  return (
    <div className={tcPage + ' overflow-y-auto'}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.14),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-15" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className={cn(tcPanel, 'p-5 md:p-6')}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_26px_rgba(34,211,238,0.18)]">
                  <Home className="h-6 w-6 text-cyan-200" />
                </div>
                <div>
                  <h1 className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-cyan-300 bg-clip-text text-3xl font-black text-transparent md:text-5xl">
                    Living & Housing
                  </h1>
                  <p className="mt-1 text-sm text-slate-400">
                    Neighborhood home, rent, leases, property market, mortgages, landlords, and tenants.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <Badge label={myNeighborhood?.name || 'No neighborhood'} tone="cyan" />
                <Badge label={myHouse?.name || myHouse?.address || 'No house linked'} tone="purple" />
                <Badge label={`Credit ${creditScore || profile?.credit_score || 0}`} tone="green" />
              </div>
            </div>

             <div className="flex flex-wrap gap-2">
               {isAdmin && (
                 <button onClick={() => setShowAdminCreateProperty(true)} className={tcDanger}>
                   <Building className="mr-2 inline h-4 w-4" />
                   Create Property
                 </button>
               )}
             </div>
          </div>
        </header>

        <nav className={cn(tcPanel, 'p-2')}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {tabs
              .filter((tab) => !tab.hidden)
              .map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-black transition',
                    activeTab === tab.key
                      ? 'border-cyan-300/40 bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)]'
                      : 'border-white/10 bg-slate-950/70 text-slate-400 hover:border-cyan-300/25 hover:text-white'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
          </div>
        </nav>

        {activeTab === 'my_home' && (
          <section className="grid gap-5 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <PanelTitle title="My Home" subtitle="Your linked neighborhood residence and active housing status." />

              {myHouse || myLease || myHouseRental ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {myHouse && (
                    <InfoCard
                      icon={<Home className="h-6 w-6 text-cyan-300" />}
                      title={myHouse.name || myHouse.address || 'Neighborhood House'}
                      subtitle={myHouse.neighborhoods?.name || myNeighborhood?.name || 'MaiTroll Neighborhood'}
                      rows={[
                        ['ZIP', myHouse.neighborhoods?.zip_code || myNeighborhood?.zip_code || 'N/A'],
                        ['Owner', myHouse.owner?.username || 'Available'],
                        ['Status', myHouse.owner_user_id || myHouse.owner_id ? 'Occupied' : 'Available'],
                      ]}
                    />
                  )}

                  {myLease && (
                    <InfoCard
                      icon={<FileText className="h-6 w-6 text-fuchsia-300" />}
                      title={myLease.property.name}
                      subtitle="Active apartment/property lease"
                      rows={[
                        ['Rent', `${currency(myLease.property.rent_amount)} TC`],
                        ['Electric', `${currency(getElectric(myLease.property))} TC`],
                        ['Water', `${currency(getWater(myLease.property))} TC`],
                        ['Next Due', myLeaseNextDue ? formatDueDate(myLeaseNextDue) : 'N/A'],
                      ]}
                      action={
                        <button disabled={!canPayLeaseRent} onClick={handlePayRent} className={tcPrimary}>
                          Pay Rent
                        </button>
                      }
                    />
                  )}

                  {myHouseRental && (
                    <InfoCard
                      icon={<Key className="h-6 w-6 text-emerald-300" />}
                      title={myHouseRental.house_name || 'House Rental'}
                      subtitle="Active house rental"
                      rows={[
                        ['Rent', `${currency(myHouseRental.rent_amount)} TC`],
                        ['Status', myHouseRental.status],
                        ['Next Due', houseRentNextDue ? formatDueDate(houseRentNextDue) : 'Now'],
                      ]}
                      action={
                        <button disabled={!canPayHouseRent} onClick={handlePayHouseRent} className={tcPrimary}>
                          Pay House Rent
                        </button>
                      }
                    />
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={<Home className="h-10 w-10 text-slate-600" />}
                  title="No active home found"
                  subtitle="Pick a house in your neighborhood or rent from the housing market."
                  action={
                    <button onClick={() => setActiveTab('market')} className={tcPrimary}>
                      Find Home
                    </button>
                  }
                />
              )}
            </Panel>

            <Panel>
              <PanelTitle title="Neighborhood Link" subtitle="Living is now tied into your neighborhood." />

              <div className="space-y-3">
                <StatCard label="Neighborhood Houses" value={neighborhoodHouses.length} />
                <StatCard label="My Applications" value={myApplications.length} />
                <StatCard label="Active Loans" value={myLoans.length} />
              </div>
            </Panel>
          </section>
        )}

        {activeTab === 'my_lease' && (
          <Panel>
            <PanelTitle title="My Lease" subtitle="Track rent, utilities, and pending applications." />

            <div className="grid gap-5 lg:grid-cols-2">
              {myLease ? (
                <InfoCard
                  icon={<FileText className="h-6 w-6 text-cyan-300" />}
                  title={myLease.property.name}
                  subtitle="Active lease"
                  rows={[
                    ['Rent', `${currency(myLease.property.rent_amount)} TC`],
                    ['Electric', `${currency(getElectric(myLease.property))} TC`],
                    ['Water', `${currency(getWater(myLease.property))} TC`],
                    ['Due Date', myLeaseNextDue ? formatDueDate(myLeaseNextDue) : 'N/A'],
                    ['Status', myLease.status],
                  ]}
                  action={
                    <button disabled={!canPayLeaseRent} onClick={handlePayRent} className={tcPrimary}>
                      Pay Rent
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  title="No active lease"
                  subtitle="Apply for a rental or rent instantly from the market."
                  icon={<FileText className="h-10 w-10 text-slate-600" />}
                />
              )}

              <div className="space-y-3">
                <h3 className="text-lg font-black text-white">My Applications</h3>

                {myApplications.length === 0 ? (
                  <p className="text-sm text-slate-500">No rental applications submitted.</p>
                ) : (
                  myApplications.map((application) => (
                    <div key={application.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-black">{application.property_name}</p>
                        <Badge
                          label={application.status}
                          tone={
                            application.status === 'approved'
                              ? 'green'
                              : application.status === 'rejected'
                                ? 'red'
                                : 'purple'
                          }
                        />
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        Rent: {currency(application.property_rent)} TC
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Panel>
        )}

        {activeTab === 'my_loans' && (
          <Panel>
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <PanelTitle title="My Mortgages" subtitle="Manage active property loans." />
              {isLandlord && (
                <button onClick={() => setShowLoanApplication(true)} className={tcSecondary}>
                  <Calculator className="mr-2 inline h-4 w-4" />
                  Loan Calculator
                </button>
              )}
            </div>

            {loading ? (
              <LoadingState />
            ) : myLoans.length === 0 ? (
              <EmptyState title="No active loans" icon={<Landmark className="h-10 w-10 text-slate-600" />} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {myLoans.map((loan) => (
                  <PropertyLoanCard key={loan.id} loan={loan} onPay={() => handlePayLoan(loan)} />
                ))}
              </div>
            )}
          </Panel>
        )}

        {activeTab === 'market' && (
          <Panel>
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <PanelTitle
                title="Housing Market"
                subtitle={
                  neighborhoodId
                    ? 'Showing properties tied to your neighborhood plus citywide listings.'
                    : 'Showing citywide listings.'
                }
              />

              <div className="flex rounded-2xl border border-white/10 bg-slate-950/70 p-1">
                <button
                  onClick={() => setMarketFilter('rent')}
                  className={cn(
                    'rounded-xl px-4 py-2 text-sm font-black transition',
                    marketFilter === 'rent' ? 'bg-cyan-300 text-slate-950' : 'text-slate-400 hover:text-white'
                  )}
                >
                  Rent
                </button>
                <button
                  onClick={() => setMarketFilter('sale')}
                  className={cn(
                    'rounded-xl px-4 py-2 text-sm font-black transition',
                    marketFilter === 'sale' ? 'bg-cyan-300 text-slate-950' : 'text-slate-400 hover:text-white'
                  )}
                >
                  Buy
                </button>
              </div>
            </div>

            {loading ? (
              <LoadingState />
            ) : properties.length === 0 ? (
              <EmptyState
                title="No properties found"
                subtitle="No listings match your neighborhood and filter right now."
                icon={<Home className="h-10 w-10 text-slate-600" />}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {properties.map((property) => (
                  <PropertyMarketCard
                    key={property.id}
                    property={property}
                    filter={marketFilter}
                    isAdmin={isAdmin}
                    isLandlord={isLandlord}
                    onRent={() => handleRent(property)}
                    onApply={() => setApplyingToProp(property)}
                    onBuy={() => setBuyingProp(property)}
                    onDelete={() => handleDeleteProperty(property.id)}
                  />
                ))}
              </div>
            )}
          </Panel>
        )}

        {activeTab === 'landlord' && (
          <Panel>
            {!isLandlord ? (
              <LandlordApplyCard
                application={landlordApplication}
                showForm={showLandlordApplication}
                setShowForm={setShowLandlordApplication}
                form={landlordAppForm}
                setForm={setLandlordAppForm}
                useLoan={useLoan}
                setUseLoan={setUseLoan}
                creditScore={creditScore}
                onSubmit={handleSubmitLandlordApplication}
              />
            ) : (
              <>
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <PanelTitle title="Landlord Dashboard" subtitle="Manage properties, tenants, and rental applications." />

                  <div className="flex rounded-2xl border border-white/10 bg-slate-950/70 p-1">
                    {(['properties', 'tenants', 'applications'] as LandlordSubTab[]).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => {
                          setLandlordSubTab(tab)
                          if (tab === 'tenants') void fetchAllTenants()
                          if (tab === 'applications') void fetchPendingApplications()
                        }}
                        className={cn(
                          'rounded-xl px-3 py-2 text-xs font-black uppercase transition',
                          landlordSubTab === tab
                            ? 'bg-cyan-300 text-slate-950'
                            : 'text-slate-400 hover:text-white'
                        )}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {landlordSubTab === 'properties' && (
                  <>
                    {ownedProperties.length === 0 ? (
                      <EmptyState
                        title="No properties owned yet"
                        subtitle="Buy a property from the market to start collecting rent."
                        icon={<Building className="h-10 w-10 text-slate-600" />}
                        action={
                          <button
                            onClick={() => {
                              setActiveTab('market')
                              setMarketFilter('sale')
                            }}
                            className={tcPrimary}
                          >
                            Buy Property
                          </button>
                        }
                      />
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {ownedProperties.map((property) => (
                          <OwnedPropertyCard
                            key={property.id}
                            property={property}
                            onEdit={() => {
                              setEditingProp(property)
                              setEditName(property.name)
                              setEditRent(String(property.rent_amount || 0))
                              setEditSalePrice(String(property.price || 0))
                              setEditIsForSale(Boolean(property.is_for_sale))
                              setEditIsForRent(Boolean(property.is_for_rent))
                              setEditMaxTenants(Number(property.max_tenants || 1))
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {landlordSubTab === 'tenants' && (
                  <TenantList
                    tenants={allTenants}
                    loading={loadingTenants}
                    onCollect={handleCollectRent}
                    onEvict={handleEvictTenant}
                  />
                )}

                {landlordSubTab === 'applications' && (
                  <ApplicationList
                    applications={pendingApplications}
                    onApprove={handleApproveApplication}
                    onDeny={handleDenyApplication}
                  />
                )}
              </>
            )}
          </Panel>
        )}

        {activeTab === 'tenants' && (
          <Panel>
            <PanelTitle title="Tenant Manager" subtitle="Collect rent and handle overdue tenants." />
            <TenantList
              tenants={allTenants}
              loading={loadingTenants}
              onCollect={handleCollectRent}
              onEvict={handleEvictTenant}
            />
          </Panel>
        )}
      </div>

      {buyingProp && (
        <Modal title="Buy Property" onClose={() => setBuyingProp(null)}>
          <div className="space-y-4">
            <PropertySummary property={buyingProp} />
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-4">
              <p className="text-sm text-slate-400">10% down payment</p>
              <p className="text-3xl font-black text-cyan-200">
                {currency(Math.ceil(Number(buyingProp.price || 0) * 0.1))} TC
              </p>
            </div>
            <button onClick={handleBuyWithLoan} className={cn(tcPrimary, 'w-full')}>
              Buy With Loan
            </button>
          </div>
        </Modal>
      )}

      {applyingToProp && (
        <Modal title="Rental Application" onClose={() => setApplyingToProp(null)}>
          <div className="space-y-4">
            <PropertySummary property={applyingToProp} />
            <textarea
              value={applicationMessage}
              onChange={(event) => setApplicationMessage(event.target.value)}
              className={cn(tcInput, 'min-h-[120px]')}
              placeholder="Message to landlord..."
            />
            <div className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-400/5 p-4 text-sm text-fuchsia-100">
              Application fee: 35 TC
            </div>
            <button onClick={handleApplyForRental} className={cn(tcPrimary, 'w-full')}>
              Submit Application
            </button>
          </div>
        </Modal>
      )}

      {editingProp && (
        <Modal title="Edit Property" onClose={() => setEditingProp(null)}>
          <div className="space-y-4">
            <Input label="Name" value={editName} onChange={setEditName} />
            <Input label="Rent" value={editRent} onChange={setEditRent} type="number" />
            <Input label="Sale Price" value={editSalePrice} onChange={setEditSalePrice} type="number" />
            <Input label="Max Tenants" value={String(editMaxTenants)} onChange={(v) => setEditMaxTenants(Number(v))} type="number" />
            <Toggle label="For Rent" checked={editIsForRent} onChange={setEditIsForRent} />
            <Toggle label="For Sale" checked={editIsForSale} onChange={setEditIsForSale} />
            <button onClick={handleUpdateProperty} className={cn(tcPrimary, 'w-full')}>
              Save Property
            </button>
          </div>
        </Modal>
      )}

      {showAdminCreateProperty && (
        <Modal title="Admin Create Property" onClose={() => setShowAdminCreateProperty(false)}>
          <div className="space-y-4">
            <Input
              label="Property Name"
              value={adminPropertyForm.name}
              onChange={(v) => setAdminPropertyForm((p) => ({ ...p, name: v }))}
            />
            <Select
              label="Type"
              value={adminPropertyForm.type_id}
              onChange={(v) => setAdminPropertyForm((p) => ({ ...p, type_id: v }))}
              options={[
                ['house', 'House'],
                ['apartment', 'Apartment'],
                ['mansion', 'Mansion'],
                ['trailer', 'Trailer'],
              ]}
            />
            <Input
              label="Rent"
              type="number"
              value={String(adminPropertyForm.rent_amount)}
              onChange={(v) => setAdminPropertyForm((p) => ({ ...p, rent_amount: Number(v) }))}
            />
            <Input
              label="Sale Price"
              type="number"
              value={String(adminPropertyForm.price)}
              onChange={(v) => setAdminPropertyForm((p) => ({ ...p, price: Number(v) }))}
            />
            <Input
              label="Electric"
              type="number"
              value={String(adminPropertyForm.electric_cost)}
              onChange={(v) => setAdminPropertyForm((p) => ({ ...p, electric_cost: Number(v) }))}
            />
            <Input
              label="Water"
              type="number"
              value={String(adminPropertyForm.water_cost)}
              onChange={(v) => setAdminPropertyForm((p) => ({ ...p, water_cost: Number(v) }))}
            />
            <Input
              label="Max Tenants"
              type="number"
              value={String(adminPropertyForm.max_tenants)}
              onChange={(v) => setAdminPropertyForm((p) => ({ ...p, max_tenants: Number(v) }))}
            />
            <textarea
              className={cn(tcInput, 'min-h-[110px]')}
              value={adminPropertyForm.description}
              onChange={(e) => setAdminPropertyForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Description"
            />
            <button onClick={handleAdminCreateProperty} className={cn(tcPrimary, 'w-full')}>
              Create Property
            </button>
          </div>
        </Modal>
      )}

      {showLoanApplication && (
        <Modal title="Mortgage Calculator" onClose={() => setShowLoanApplication(false)}>
          <div className="space-y-4">
            <Input
              label="Property Value"
              type="number"
              value={String(loanAppForm.property_value || '')}
              onChange={(v) => {
                const value = Number(v) || 0
                setLoanAppForm((p) => ({
                  ...p,
                  property_value: value,
                  down_payment: Math.ceil(value * 0.1),
                  loan_amount: value - Math.ceil(value * 0.1),
                }))
              }}
            />
            <Select
              label="Property Type"
              value={loanAppForm.property_type}
              onChange={(v) => setLoanAppForm((p) => ({ ...p, property_type: v }))}
              options={[
                ['house', 'House'],
                ['apartment', 'Apartment'],
                ['mansion', 'Mansion'],
                ['trailer', 'Trailer'],
              ]}
            />
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
              <SummaryRow label="Down Payment" value={`${currency(loanAppForm.down_payment)} TC`} />
              <SummaryRow label="Loan Amount" value={`${currency(loanAppForm.loan_amount)} TC`} />
              <SummaryRow label="Weekly Payment" value={`${currency(Math.ceil(loanAppForm.loan_amount / 50))} TC`} />
            </div>
            <button
              onClick={() => toast.error("Use 'Buy with Loan' from the property market.")}
              className={cn(tcSecondary, 'w-full')}
            >
              Continue From Market
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn(tcPanel, 'p-5 md:p-6', className)}>{children}</section>
}

function PanelTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="bg-gradient-to-r from-cyan-200 to-fuchsia-200 bg-clip-text text-2xl font-black text-transparent">
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
    </div>
  )
}

function Badge({ label, tone = 'cyan' }: { label: string; tone?: 'cyan' | 'purple' | 'green' | 'red' }) {
  return (
    <span
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em]',
        tone === 'cyan' && 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100',
        tone === 'purple' && 'border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-100',
        tone === 'green' && 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
        tone === 'red' && 'border-red-300/25 bg-red-400/10 text-red-100'
      )}
    >
      {label}
    </span>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
      <p className="text-3xl font-black text-cyan-200">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-2 last:border-b-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="font-mono font-black text-white">{value}</span>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-h-[260px] items-center justify-center text-center">
      <div>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
          {icon}
        </div>
        <p className="text-lg font-black text-white">{title}</p>
        {subtitle && <p className="mt-1 max-w-md text-sm text-slate-500">{subtitle}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-[260px] items-center justify-center">
      <Loader2 className="h-9 w-9 animate-spin text-cyan-300" />
    </div>
  )
}

function InfoCard({
  icon,
  title,
  subtitle,
  rows,
  action,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  rows: Array<[string, string]>
  action?: React.ReactNode
}) {
  return (
    <div className={cn(tcCard, 'p-5')}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-black">{title}</h3>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map(([label, value]) => (
          <SummaryRow key={label} label={label} value={value} />
        ))}
      </div>

      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

function PropertySummary({ property }: { property: Property }) {
  return (
    <div className={cn(tcCard, 'p-4')}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10">
          <PropertyIcon type={getType(property)} />
        </div>
        <div>
          <h3 className="text-lg font-black">{property.name}</h3>
          <p className="text-sm text-slate-400">{property.description || 'MaiTroll property'}</p>
        </div>
      </div>
    </div>
  )
}

function PropertyMarketCard({
  property,
  filter,
  isAdmin,
  isLandlord,
  onRent,
  onApply,
  onBuy,
  onDelete,
}: {
  property: Property
  filter: MarketFilter
  isAdmin: boolean
  isLandlord: boolean
  onRent: () => void
  onApply: () => void
  onBuy: () => void
  onDelete: () => void
}) {
  const totalMoveIn = Number(property.rent_amount || 0) + getElectric(property) + getWater(property)

  return (
    <div className={cn(tcCard, 'p-5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <PropertyIcon type={getType(property)} />
          <div>
            <h3 className="font-black">{property.name}</h3>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{getType(property)}</p>
          </div>
        </div>
        <Badge label={`${property.occupancy || 0}/${property.max_tenants || 1}`} tone="purple" />
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-slate-400">{property.description || 'No description.'}</p>

      <div className="mt-4 space-y-2">
        {filter === 'rent' ? (
          <>
            <SummaryRow label="Rent" value={`${currency(property.rent_amount)} TC`} />
            <SummaryRow label="Electric" value={`${currency(getElectric(property))} TC`} />
            <SummaryRow label="Water" value={`${currency(getWater(property))} TC`} />
            <SummaryRow label="Move-in Total" value={`${currency(totalMoveIn)} TC`} />
          </>
        ) : (
          <>
            <SummaryRow label="Price" value={`${currency(property.price)} TC`} />
            <SummaryRow label="Down Payment" value={`${currency(Math.ceil(Number(property.price || 0) * 0.1))} TC`} />
            <SummaryRow label="Owner" value={property.owner?.username || 'City Bank'} />
          </>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {filter === 'rent' ? (
          <>
            <button onClick={onRent} className={tcPrimary}>
              Rent Now
            </button>
            <button onClick={onApply} className={tcSecondary}>
              Apply
            </button>
          </>
        ) : (
          <button disabled={!isLandlord && !isAdmin} onClick={onBuy} className={tcPrimary}>
            Buy With Loan
          </button>
        )}

        {isAdmin && (
          <button onClick={onDelete} className={tcDanger}>
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function OwnedPropertyCard({ property, onEdit }: { property: Property; onEdit: () => void }) {
  return (
    <div className={cn(tcCard, 'p-5')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <PropertyIcon type={getType(property)} />
          <div>
            <h3 className="font-black">{property.name}</h3>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{getType(property)}</p>
          </div>
        </div>

        <button onClick={onEdit} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:text-white">
          <Edit2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-2">
        <SummaryRow label="Rent" value={`${currency(property.rent_amount)} TC`} />
        <SummaryRow label="Electric" value={`${currency(getElectric(property))} TC`} />
        <SummaryRow label="Water" value={`${currency(getWater(property))} TC`} />
        <SummaryRow label="Occupancy" value={`${property.occupancy || 0}/${property.max_tenants || 1}`} />
      </div>
    </div>
  )
}

function PropertyLoanCard({ loan, onPay }: { loan: LandlordLoan; onPay: () => void }) {
  return (
    <div className={cn(tcCard, 'p-5')}>
      <div className="flex items-start gap-3">
        <PropertyIcon type={getType(loan.property)} />
        <div>
          <h3 className="font-black">{loan.property?.name || 'Property Loan'}</h3>
          <p className="text-sm text-slate-400">Active mortgage</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <SummaryRow label="Loan Amount" value={`${currency(loan.loan_amount || loan.amount)} TC`} />
        <SummaryRow label="Remaining" value={`${currency(loan.remaining_balance)} TC`} />
        <SummaryRow label="Payment" value={`${currency(loan.monthly_payment)} TC`} />
      </div>

      <button onClick={onPay} className={cn(tcPrimary, 'mt-4 w-full')}>
        Pay Mortgage
      </button>
    </div>
  )
}

function TenantList({
  tenants,
  loading,
  onCollect,
  onEvict,
}: {
  tenants: TenantLease[]
  loading: boolean
  onCollect: (lease: TenantLease) => void
  onEvict: (lease: TenantLease) => void
}) {
  if (loading) return <LoadingState />

  if (tenants.length === 0) {
    return <EmptyState title="No active tenants" icon={<Users className="h-10 w-10 text-slate-600" />} />
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {tenants.map((tenant) => (
        <div key={tenant.id} className={cn(tcCard, 'p-5')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-black">{tenant.tenant_username}</h3>
              <p className="text-sm text-slate-400">{tenant.property_name}</p>
            </div>
            {tenant.is_overdue && <Badge label="Overdue" tone="red" />}
          </div>

          <div className="mt-4 space-y-2">
            <SummaryRow label="Rent" value={`${currency(tenant.rent_amount)} TC`} />
            <SummaryRow label="Electric" value={`${currency(tenant.electric_cost)} TC`} />
            <SummaryRow label="Water" value={`${currency(tenant.water_cost)} TC`} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => onCollect(tenant)} className={tcPrimary}>
              Collect
            </button>
            <button onClick={() => onEvict(tenant)} className={tcDanger}>
              <UserMinus className="mr-2 inline h-4 w-4" />
              Evict
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ApplicationList({
  applications,
  onApprove,
  onDeny,
}: {
  applications: RentalApplication[]
  onApprove: (application: RentalApplication) => void
  onDeny: (application: RentalApplication) => void
}) {
  if (applications.length === 0) {
    return <EmptyState title="No pending applications" icon={<FileText className="h-10 w-10 text-slate-600" />} />
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {applications.map((application) => (
        <div key={application.id} className={cn(tcCard, 'p-5')}>
          <h3 className="font-black">{application.applicant_username}</h3>
          <p className="text-sm text-slate-400">{application.property_name}</p>

          <div className="mt-4 space-y-2">
            <SummaryRow label="Credit" value={String(application.applicant_credit_score || 0)} />
            <SummaryRow label="Jail Count" value={String(application.applicant_jail_count || 0)} />
            <SummaryRow label="Rent" value={`${currency(application.property_rent)} TC`} />
          </div>

          {application.message && (
            <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
              {application.message}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button onClick={() => onApprove(application)} className={tcPrimary}>
              Approve
            </button>
            <button onClick={() => onDeny(application)} className={tcDanger}>
              Deny
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function LandlordApplyCard({
  application,
  showForm,
  setShowForm,
  form,
  setForm,
  useLoan,
  setUseLoan,
  creditScore,
  onSubmit,
}: any) {
  if (!showForm && application?.status === 'pending') {
    return (
      <EmptyState
        title="Landlord application pending"
        subtitle="Your application is already submitted."
        icon={<FileText className="h-10 w-10 text-fuchsia-300" />}
      />
    )
  }

  if (!showForm) {
    return (
      <EmptyState
        title="Become a Landlord"
        subtitle="Get a landlord license, buy properties, collect rent, and manage tenants."
        icon={<Building className="h-10 w-10 text-cyan-300" />}
        action={
          <button onClick={() => setShowForm(true)} className={tcPrimary}>
            Apply Now
          </button>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <Input
        label="Years of Experience"
        type="number"
        value={String(form.experience_years)}
        onChange={(v) => setForm((p: any) => ({ ...p, experience_years: Number(v) }))}
      />

      <textarea
        className={cn(tcInput, 'min-h-[140px]')}
        value={form.business_plan}
        onChange={(e) => setForm((p: any) => ({ ...p, business_plan: e.target.value }))}
        placeholder="Business plan / why you want to be a landlord..."
      />

      <Toggle
        label="I have startup capital"
        checked={form.has_startup_capital}
        onChange={(checked) => setForm((p: any) => ({ ...p, has_startup_capital: checked }))}
      />

      {creditScore > 650 && (
        <Toggle label="Use instant mortgage / license loan" checked={useLoan} onChange={setUseLoan} />
      )}

      <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
        <SummaryRow label="Landlord License" value="7,000 TC" />
        <SummaryRow label="Due Today" value={useLoan ? '700 TC' : '7,000 TC'} />
      </div>

      <button onClick={onSubmit} className={cn(tcPrimary, 'w-full')}>
        Submit Application
      </button>
    </div>
  )
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-cyan-100">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={tcInput} />
    </label>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<[string, string]>
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-cyan-100">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={tcInput}>
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue} className="bg-slate-950 text-white">
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <span className="font-bold text-slate-200">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-cyan-300"
      />
    </label>
  )
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-cyan-300/20 bg-slate-950 p-6 text-white shadow-[0_0_60px_rgba(34,211,238,0.22)]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="bg-gradient-to-r from-cyan-200 to-fuchsia-200 bg-clip-text text-2xl font-black text-transparent">
            {title}
          </h2>
          <button onClick={onClose} className="rounded-xl border border-red-300/25 bg-red-500/15 p-2 text-red-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
