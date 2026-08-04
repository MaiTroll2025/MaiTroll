import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  Car,
  Clock,
  Coins,
  DollarSign,
  Grid,
  Heart,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Palette,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShoppingBag,
  Star,
  Store,
  Tv,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { validateFile, FILE_VALIDATION } from '../lib/fileValidation'

const PREMIUM_FEATURES = {
  featured: {
    cost: 50,
    label: 'Featured',
    icon: '⭐',
    description: 'Appear near the top of search results for 7 days.',
  },
  pinned: {
    cost: 100,
    label: 'Pin to Top',
    icon: '📌',
    description: 'Stay at the very top of Trollifieds for 7 days.',
  },
  highlighted: {
    cost: 150,
    label: 'Highlight',
    icon: '✨',
    description: 'Add premium glow styling to your listing.',
  },
  auto_promo: {
    cost: 200,
    label: 'Auto Promo',
    icon: '📺',
    description: 'Promote this listing automatically in streams.',
  },
}

const MARKETPLACE_CATEGORIES = [
  { id: 'electronics', label: 'Electronics', icon: '📱' },
  { id: 'clothing', label: 'Clothing', icon: '👕' },
  { id: 'furniture', label: 'Furniture', icon: '🪑' },
  { id: 'vehicles', label: 'Vehicles', icon: '🚗' },
  { id: 'sports', label: 'Sports', icon: '⚽' },
  { id: 'toys', label: 'Toys & Games', icon: '🎮' },
  { id: 'home', label: 'Home & Garden', icon: '🏡' },
  { id: 'beauty', label: 'Beauty', icon: '💄' },
  { id: 'books', label: 'Books', icon: '📚' },
  { id: 'other', label: 'Other', icon: '📦' },
]

const SERVICE_CATEGORIES = [
  { id: 'mechanic', label: 'Mechanics', icon: '🔧' },
  { id: 'mover', label: 'Movers', icon: '📦' },
  { id: 'electrician', label: 'Electricians', icon: '⚡' },
  { id: 'plumber', label: 'Plumbers', icon: '🚿' },
  { id: 'barber', label: 'Barbers', icon: '💇' },
  { id: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { id: 'tutor', label: 'Tutors', icon: '📖' },
  { id: 'photographer', label: 'Photographers', icon: '📷' },
  { id: 'event_planner', label: 'Event Planners', icon: '🎉' },
  { id: 'contractor', label: 'Contractors', icon: '🏗️' },
  { id: 'freelancer', label: 'Freelancers', icon: '💼' },
  { id: 'other', label: 'Other', icon: '🔨' },
]

type ActiveTab = 'marketplace' | 'vehicles' | 'services' | 'shop_items'
type SortBy = 'newest' | 'price_low' | 'price_high' | 'distance'

interface BaseListing {
  id: string
  title: string
  description?: string
  price_coins?: number
  price_usd?: number
  category?: string
  condition?: string
  city?: string
  state?: string
  images?: string[]
  image_url?: string
  status?: string
  created_at: string
  latitude?: number
  longitude?: number
  seller_id?: string
  owner_id?: string
  business_id?: string
  business_name?: string
  business_rating?: number
  total_reviews?: number
  make?: string
  model?: string
  year?: number
  is_featured?: boolean
  is_pinned?: boolean
  is_highlighted?: boolean
  is_auto_promo?: boolean
  seller?: {
    id?: string
    username?: string
    avatar_url?: string
  }
  owner?: {
    id?: string
    username?: string
    avatar_url?: string
  }
  distance_km?: number
  is_shop_item?: boolean
  shop_id?: string
  shop_name?: string
  stock_quantity?: number
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  return radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function kmToMiles(km: number) {
  return km * 0.621371
}

function offsetCoordinate(lat: number, lon: number, distanceKm = 1.6) {
  const radius = 6371
  const angle = Math.random() * 2 * Math.PI
  const angularDistance = distanceKm / radius
  const latRad = (lat * Math.PI) / 180
  const lonRad = (lon * Math.PI) / 180

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(angle)
  )

  const newLonRad =
    lonRad +
    Math.atan2(
      Math.sin(angle) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
    )

  return {
    lat: (newLatRad * 180) / Math.PI,
    lon: (newLonRad * 180) / Math.PI,
  }
}

function RecenterControl({ location }: { location: { lat: number; lon: number } }) {
  const map = useMap()
  const hasCentered = useRef(false)

  useEffect(() => {
    if (!hasCentered.current) {
      map.setView([location.lat, location.lon], 13)
      hasCentered.current = true
    }
  }, [map, location.lat, location.lon])

  return null
}

const userLocationIcon = L.divIcon({
  className: 'custom-user-marker',
  html: `
    <div style="
      width:24px;
      height:24px;
      background:#22d3ee;
      border:3px solid #ffffff;
      border-radius:9999px;
      box-shadow:0 0 24px rgba(34,211,238,.75);
    "></div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

export default function Trollifieds() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const mapRef = useRef<L.Map | null>(null)

  const [activeTab, setActiveTab] = useState<ActiveTab>('marketplace')
  const [showMap, setShowMap] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [loading, setLoading] = useState(true)

  const [marketplaceItems, setMarketplaceItems] = useState<BaseListing[]>([])
  const [vehicleListings, setVehicleListings] = useState<BaseListing[]>([])
  const [services, setServices] = useState<BaseListing[]>([])
  const [shopItems, setShopItems] = useState<BaseListing[]>([])

  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  // Obfuscated location for map display — offsets real location by ~1 mile for privacy
  const [displayLocation, setDisplayLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.8283, -98.5795])
  const [mapRadius, setMapRadius] = useState(16)

  const [messageModal, setMessageModal] = useState<{
    open: boolean
    recipientId?: string
    listingId?: string
    listingType?: string
  }>({ open: false })

  const [messageText, setMessageText] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  const [premiumModal, setPremiumModal] = useState<{
    open: boolean
    listingId?: string
    listingType?: string
  }>({ open: false })

  const [purchasingPremium, setPurchasingPremium] = useState(false)

  const [itemDetail, setItemDetail] = useState<{
    open: boolean
    item?: BaseListing
  }>({ open: false })

  const [createModal, setCreateModal] = useState<{
    open: boolean
    type: ActiveTab
  }>({ open: false, type: 'marketplace' })

  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    price_coins: '',
    price_usd: '',
    category: '',
    condition: 'good',
    delivery_type: 'both',
    city: '',
    state: '',
    images: [] as File[],
  })

  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!navigator.geolocation) {
      const fallback = { lat: 39.8283, lon: -98.5795 }
      setUserLocation(fallback)
      setDisplayLocation(offsetCoordinate(fallback.lat, fallback.lon, 1.6))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const real = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        }
        setUserLocation(real)
        // Offset by ~1 mile (1.6 km) so the user's real location is never shown
        setDisplayLocation(offsetCoordinate(real.lat, real.lon, 1.6))
      },
      () => {
        const fallback = { lat: 39.8283, lon: -98.5795 }
        setUserLocation(fallback)
        setDisplayLocation(offsetCoordinate(fallback.lat, fallback.lon, 1.6))
      }
    )
  }, [])

  useEffect(() => {
    // Use the obfuscated display location for the map center
    if (displayLocation) {
      setMapCenter([displayLocation.lat, displayLocation.lon])
    }
  }, [displayLocation])

  const loadData = useCallback(async () => {
    setLoading(true)

    try {
      if (activeTab === 'marketplace') {
        let query = supabase
          .from('marketplace_items')
          .select(`
            *,
            seller:user_profiles!seller_id(id, username, avatar_url)
          `)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(100)

        if (category) query = query.eq('category', category)
        if (searchQuery.trim()) query = query.ilike('title', `%${searchQuery.trim()}%`)

        const { data, error } = await query
        if (error) throw error

        setMarketplaceItems(data || [])
      }

      if (activeTab === 'vehicles') {
        let query = supabase
          .from('vehicle_listings')
          .select(`
            *,
            owner:user_profiles!owner_id(id, username, avatar_url)
          `)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(100)

        if (searchQuery.trim()) query = query.ilike('title', `%${searchQuery.trim()}%`)

        const { data, error } = await query
        if (error) throw error

        setVehicleListings(
          (data || []).map((item: any) => ({
            ...item,
            seller_id: item.owner_id,
            seller: item.owner,
          }))
        )
      }

      if (activeTab === 'services') {
        let serviceQuery = supabase
          .from('service_listings')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(100)

        if (category) serviceQuery = serviceQuery.eq('category', category)
        if (searchQuery.trim()) serviceQuery = serviceQuery.ilike('title', `%${searchQuery.trim()}%`)

        const { data: servicesData, error: serviceError } = await serviceQuery
        if (serviceError) throw serviceError

        const businessIds = Array.from(
          new Set((servicesData || []).map((service: any) => service.business_id).filter(Boolean))
        )

        let businessMap: Record<string, any> = {}

        if (businessIds.length > 0) {
          const { data: businessProfiles } = await supabase
            .from('business_profiles')
            .select('id, business_name, rating, owner_id')
            .in('id', businessIds)

          businessMap = (businessProfiles || []).reduce((acc: Record<string, any>, business: any) => {
            acc[business.id] = business
            return acc
          }, {})
        }

        setServices(
          (servicesData || []).map((service: any) => ({
            ...service,
            business_name: businessMap[service.business_id]?.business_name,
            business_rating: businessMap[service.business_id]?.rating,
            seller_id: businessMap[service.business_id]?.owner_id,
          }))
        )
      }

      // Load shop_items from all active shops — these are the Marketplace seller listings
      // that should appear on the Trollifieds map for everyone to discover
      if (activeTab === 'shop_items') {
        const { data: shopsData, error: shopsError } = await supabase
          .from('MaiTroll_shops')
          .select(`
            id,
            name,
            owner_id,
            owner:user_profiles!owner_id(id, username, avatar_url)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(100)

        if (shopsError) throw shopsError

        const allShopItems: BaseListing[] = []

        for (const shop of shopsData || []) {
          let itemsQuery = supabase
            .from('shop_items')
            .select('*')
            .eq('shop_id', shop.id)
            .order('created_at', { ascending: false })
            .limit(50)

          if (searchQuery.trim()) {
            itemsQuery = itemsQuery.ilike('name', `%${searchQuery.trim()}%`)
          }

          const { data: itemsData, error: itemsError } = await itemsQuery
          if (itemsError) {
            console.error(`Error loading items for shop ${shop.id}:`, itemsError)
            continue
          }

          for (const item of itemsData || []) {
            allShopItems.push({
              id: `shop_${item.id}`,
              title: item.name,
              description: item.description,
              price_coins: item.price,
              category: item.category || 'other',
              image_url: item.image_url || item.thumbnail_url,
              images: item.image_url ? [item.image_url] : [],
              status: 'active',
              created_at: item.created_at,
              seller_id: shop.owner_id,
              seller: shop.owner,
              // Shop items don't have lat/lon — they appear as shop-level pins
              latitude: undefined,
              longitude: undefined,
              city: undefined,
              state: undefined,
              is_shop_item: true,
              shop_id: shop.id,
              shop_name: shop.name,
              stock_quantity: item.stock_quantity,
            } as BaseListing & { is_shop_item?: boolean; shop_id?: string; shop_name?: string; stock_quantity?: number })
          }
        }

        setShopItems(allShopItems)
      }
    } catch (error: any) {
      console.error('Error loading Trollifieds:', error)
      toast.error(error.message || 'Failed to load listings')
    } finally {
      setLoading(false)
    }
  }, [activeTab, category, searchQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const tableMap: Record<string, string> = {
      marketplace: 'marketplace_items',
      vehicles: 'vehicle_listings',
      services: 'service_listings',
      shop_items: 'shop_items',
    }

    const tableName = tableMap[activeTab]
    if (!tableName) return

    const channel = supabase
      .channel(`trollifieds_${activeTab}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [activeTab, loadData])

  const activeItems = useMemo(() => {
    if (activeTab === 'marketplace') return [...marketplaceItems]
    if (activeTab === 'vehicles') return [...vehicleListings]
    if (activeTab === 'shop_items') return [...shopItems]
    return [...services]
  }, [activeTab, marketplaceItems, vehicleListings, services, shopItems])

  const filteredItems = useMemo(() => {
    let items = [...activeItems]

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()

      items = items.filter((item) => {
        return (
          item.title?.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.business_name?.toLowerCase().includes(query) ||
          item.make?.toLowerCase().includes(query) ||
          item.model?.toLowerCase().includes(query)
        )
      })
    }

    // Use the real userLocation for distance calculations (not the obfuscated display location)
    if (userLocation) {
      items = items.map((item) => {
        if (!item.latitude || !item.longitude) return item

        return {
          ...item,
          distance_km: calculateDistance(userLocation.lat, userLocation.lon, item.latitude, item.longitude),
        }
      })
    }

    items.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      if (a.is_featured && !b.is_featured) return -1
      if (!a.is_featured && b.is_featured) return 1
      if (a.is_highlighted && !b.is_highlighted) return -1
      if (!a.is_highlighted && b.is_highlighted) return 1
      if (a.is_auto_promo && !b.is_auto_promo) return -1
      if (!a.is_auto_promo && b.is_auto_promo) return 1

      if (sortBy === 'price_low') return Number(a.price_usd || 0) - Number(b.price_usd || 0)
      if (sortBy === 'price_high') return Number(b.price_usd || 0) - Number(a.price_usd || 0)
      if (sortBy === 'distance') return Number(a.distance_km || 9999) - Number(b.distance_km || 9999)

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return items
  }, [activeItems, searchQuery, sortBy, userLocation])

  // Map items: show ALL listings that have coordinates from every listing type
  // (marketplace_items, vehicles, services) — shop items don't have lat/lon
  // Use displayLocation (obfuscated) for the map radius filter so the user's real location stays private
  const allListingsWithCoords = useMemo(() => {
    return [
      ...marketplaceItems,
      ...vehicleListings,
      ...services,
    ].filter((item) => item.latitude && item.longitude)
  }, [marketplaceItems, vehicleListings, services])

  const mapItems = useMemo(() => {
    const loc = displayLocation || userLocation
    if (!loc) return []

    return allListingsWithCoords
      .filter((item) => {
        const distance = calculateDistance(
          loc.lat,
          loc.lon,
          Number(item.latitude),
          Number(item.longitude)
        )

        return distance <= mapRadius
      })
  }, [allListingsWithCoords, mapRadius, displayLocation, userLocation])

  const categoryList =
    activeTab === 'marketplace'
      ? MARKETPLACE_CATEGORIES
      : activeTab === 'services'
        ? SERVICE_CATEGORIES
        : activeTab === 'shop_items'
          ? [{ id: 'all', label: 'All Shops', icon: '🏪' }]
          : [{ id: 'all', label: 'All Makes', icon: '🚗' }]

  const openCreateModal = (type: ActiveTab) => {
    if (!user) {
      navigate('/auth')
      return
    }

    setCreateModal({ open: true, type })
  }

  const openMessageModal = (recipientId?: string, listingId?: string, listingType?: string) => {
    if (!user) {
      navigate('/auth')
      return
    }

    if (!recipientId) {
      toast.error('Seller not found')
      return
    }

    setMessageModal({
      open: true,
      recipientId,
      listingId,
      listingType,
    })
  }

  const openPremiumModal = (listingId: string, listingType: string) => {
    if (!user) {
      navigate('/auth')
      return
    }

    setPremiumModal({
      open: true,
      listingId,
      listingType,
    })
  }

  const handleSendMessage = async () => {
    if (!user) {
      navigate('/auth')
      return
    }

    if (!messageText.trim()) {
      toast.error('Please enter a message')
      return
    }

    setSendingMessage(true)

    try {
      const { error } = await supabase.rpc('send_marketplace_message', {
        p_recipient_id: messageModal.recipientId,
        p_listing_id: messageModal.listingId,
        p_listing_type: messageModal.listingType,
        p_message: messageText.trim(),
      })

      if (error) throw error

      toast.success('Message sent')
      setMessageModal({ open: false })
      setMessageText('')
    } catch (error: any) {
      console.error('Message error:', error)
      toast.error(error.message || 'Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const handlePurchasePremium = async (featureType: keyof typeof PREMIUM_FEATURES) => {
    if (!user || !premiumModal.listingId) return

    setPurchasingPremium(true)

    try {
      const { error } = await supabase.rpc('purchase_listing_premium', {
        p_listing_id: premiumModal.listingId,
        p_listing_type: premiumModal.listingType || activeTab,
        p_feature_type: featureType,
        p_seller_id: user.id,
        p_duration_days: 7,
      })

      if (error) throw error

      toast.success(`${PREMIUM_FEATURES[featureType].label} purchased`)
      setPremiumModal({ open: false })
      loadData()
    } catch (error: any) {
      console.error('Premium purchase error:', error)
      toast.error(error.message || 'Failed to purchase boost')
    } finally {
      setPurchasingPremium(false)
    }
  }

  const handleCreateListing = async () => {
    if (!user) {
      navigate('/auth')
      return
    }

    // Shop items don't require geolocation — they're tied to the seller's shop
    if (createModal.type !== 'shop_items' && !userLocation) {
      toast.error('Location is required for local listings')
      return
    }

    if (!createForm.title.trim() || !createForm.description.trim()) {
      toast.error('Title and description are required')
      return
    }

    if (!createForm.price_coins && !createForm.price_usd) {
      toast.error('Enter a coin or USD price')
      return
    }

    setCreating(true)

    try {
      const imageUrls: string[] = []

      for (const image of createForm.images.slice(0, 5)) {
        const validation = validateFile(image, FILE_VALIDATION.image.types, FILE_VALIDATION.image.maxSize, 'Listing image')
        if (!validation.valid) {
          toast.error(validation.error!)
          setCreating(false)
          return
        }
        const fileExt = image.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
        const filePath = `marketplace/${user.id}/${fileName}`

        const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, image)

        if (uploadError) throw uploadError

        const { data } = supabase.storage.from('post-images').getPublicUrl(filePath)
        imageUrls.push(data.publicUrl)
      }

      const randomDistanceKm = 1.4 + Math.random() * 0.4
      const obfuscatedLocation = offsetCoordinate(userLocation.lat, userLocation.lon, randomDistanceKm)

      const { error } = await supabase.rpc('create_marketplace_listing', {
        p_title: createForm.title.trim(),
        p_description: createForm.description.trim(),
        p_price_coins: createForm.price_coins ? parseInt(createForm.price_coins, 10) : null,
        p_price_usd: createForm.price_usd ? parseFloat(createForm.price_usd) : null,
        p_category: createForm.category || 'other',
        p_condition: createForm.condition,
        p_delivery_type: createForm.delivery_type,
        p_latitude: obfuscatedLocation.lat,
        p_longitude: obfuscatedLocation.lon,
        p_city: createForm.city.trim() || null,
        p_state: createForm.state.trim() || null,
        p_images: imageUrls,
        p_stock: 1,
      })

      if (error) throw error

      toast.success('Listing created')
      setCreateModal({ open: false, type: 'marketplace' })
      setCreateForm({
        title: '',
        description: '',
        price_coins: '',
        price_usd: '',
        category: '',
        condition: 'good',
        delivery_type: 'both',
        city: '',
        state: '',
        images: [],
      })
      loadData()
    } catch (error: any) {
      console.error('Create listing error:', error)
      toast.error(error.message || 'Failed to create listing')
    } finally {
      setCreating(false)
    }
  }

  const getImage = (item: BaseListing) => {
    if (item.images?.length) return item.images[0]
    if (item.image_url) return item.image_url
    return null
  }

  const getSellerId = (item: BaseListing) => {
    return item.seller_id || item.owner_id || item.seller?.id || item.owner?.id
  }

  const getSellerName = (item: BaseListing) => {
    if (item.is_shop_item) return item.seller?.username || item.owner?.username || 'Shop Seller'
    return item.seller?.username || item.owner?.username || 'Unknown'
  }

  const getPriceDisplay = (item: BaseListing) => {
    if (item.price_coins && item.price_usd) {
      return `${item.price_coins.toLocaleString()} coins · $${item.price_usd.toLocaleString()}`
    }

    if (item.price_coins) return `${item.price_coins.toLocaleString()} coins`
    if (item.price_usd) return `$${item.price_usd.toLocaleString()}`
    return 'Contact for price'
  }

  const formatDate = (date: string) => {
    const created = new Date(date)
    const now = new Date()
    const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))

    if (days <= 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return created.toLocaleDateString()
  }

  return (
    <div className="min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(168,85,247,0.13),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(236,72,153,0.08),transparent_36%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[size:52px_52px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
        <header className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                <Store className="h-4 w-4" />
                Mai Troll Local Marketplace
              </div>

              <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                Trollifieds
                <span className="block bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                  Buy · Sell · Services
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
                Local listings, shop items, vehicles, and services powered by Troll Coins, USD pricing, boosted posts, private messaging, and privacy-safe map discovery.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard icon={ShoppingBag} label="Listings" value={marketplaceItems.length} />
              <StatCard icon={Store} label="Shop Items" value={shopItems.length} />
              <StatCard icon={Car} label="Vehicles" value={vehicleListings.length} />
              <StatCard icon={Wrench} label="Services" value={services.length} />
              <StatCard icon={Zap} label="Boosts" value="Live" pink />
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-4 backdrop-blur-xl">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search items, vehicles, services..."
                  className="h-13 w-full rounded-2xl border border-cyan-400/20 bg-black/40 py-3 pl-12 pr-12 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              <button
                onClick={() => openCreateModal(activeTab)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.24)] transition hover:bg-cyan-300"
              >
                <Plus className="h-4 w-4" />
                Create Listing
              </button>

              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex gap-2 overflow-x-auto">
                <TabButton active={activeTab === 'marketplace'} icon={ShoppingBag} label="Marketplace" onClick={() => { setActiveTab('marketplace'); setCategory(null) }} />
                <TabButton active={activeTab === 'shop_items'} icon={Store} label="Shop Items" onClick={() => { setActiveTab('shop_items'); setCategory(null) }} />
                <TabButton active={activeTab === 'vehicles'} icon={Car} label="Vehicles" onClick={() => { setActiveTab('vehicles'); setCategory(null) }} />
                <TabButton active={activeTab === 'services'} icon={Wrench} label="Services" onClick={() => { setActiveTab('services'); setCategory(null) }} />
              </div>

              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortBy)}
                  className="rounded-2xl border border-cyan-400/20 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-cyan-300/60"
                >
                  <option value="newest">Newest First</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="distance">Nearest First</option>
                </select>

                <button
                  onClick={() => setShowMap(false)}
                  className={`rounded-2xl border px-4 py-3 ${!showMap ? 'border-cyan-300/30 bg-cyan-400 text-slate-950' : 'border-cyan-400/20 bg-black/30 text-cyan-200'}`}
                >
                  <Grid className="h-4 w-4" />
                </button>

                <button
                  onClick={() => setShowMap((prev) => !prev)}
                  className={`rounded-2xl border px-4 py-3 ${showMap ? 'border-cyan-300/30 bg-cyan-400 text-slate-950' : 'border-cyan-400/20 bg-black/30 text-cyan-200'}`}
                >
                  <MapPin className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <CategoryPill active={!category} label="All" icon="✨" onClick={() => setCategory(null)} />
              {categoryList.map((cat) => (
                <CategoryPill
                  key={cat.id}
                  active={category === cat.id}
                  label={cat.label}
                  icon={cat.icon}
                  onClick={() => setCategory(cat.id === 'all' ? null : cat.id)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-yellow-400/20 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-yellow-300" />
            <p className="text-sm leading-6 text-yellow-100">
              Mai Troll does not verify physical goods, shipping, pickup, seller claims, or package contents. Illegal items are prohibited and may be reported.
              Exact map locations are intentionally offset for user safety.
            </p>
          </div>
        </section>

        {loading ? (
          <SkeletonGrid />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            onClear={() => {
              setSearchQuery('')
              setCategory(null)
            }}
          />
        ) : (
          <>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="text-sm font-bold text-slate-400">
                {filteredItems.length}{' '}
                {activeTab === 'marketplace'
                  ? 'items'
                  : activeTab === 'vehicles'
                    ? 'vehicles'
                    : activeTab === 'shop_items'
                      ? 'shop items'
                      : 'services'}{' '}
                found
              </p>
              {displayLocation && (
                <p className="flex items-center gap-2 text-sm text-cyan-300">
                  <MapPin className="h-4 w-4" />
                  Nearby discovery enabled
                  <span className="text-xs text-slate-500">(location offset for privacy)</span>
                </p>
              )}
            </div>

            {!showMap && (
              <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {filteredItems.map((item) => (
                  <ListingCard
                    key={item.id}
                    item={item}
                    activeTab={activeTab}
                    userId={user?.id}
                    getImage={getImage}
                    getPriceDisplay={getPriceDisplay}
                    formatDate={formatDate}
                    getSellerId={getSellerId}
                    onOpen={() => setItemDetail({ open: true, item })}
                    onMessage={() => openMessageModal(getSellerId(item), item.id, activeTab)}
                    onBuy={() => {
                      const buyMessage = `Hi, I'm interested in buying "${item.title}". Is it still available?`
                      setMessageText(buyMessage)
                      openMessageModal(getSellerId(item), item.id, activeTab)
                    }}
                    onBoost={() => openPremiumModal(item.id, activeTab)}
                  />
                ))}
              </section>
            )}

            {showMap && (
              <section className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-5 shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-xl font-black text-white">
                      <MapPin className="h-5 w-5 text-cyan-300" />
                      Nearby Listings Map
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Showing {mapItems.length} listing{mapItems.length === 1 ? '' : 's'} within {kmToMiles(mapRadius).toFixed(1)} mi.
                      <span className="text-xs text-slate-500 ml-2">(includes marketplace, vehicles & services)</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0.5"
                      max="50"
                      step="0.5"
                      value={mapRadius}
                      onChange={(event) => setMapRadius(Number(event.target.value))}
                    />
                    <span className="text-sm font-black text-cyan-200">
                      {kmToMiles(mapRadius).toFixed(1)} mi
                    </span>
                  </div>
                </div>

                <div className="h-[560px] overflow-hidden rounded-[1.5rem] border border-cyan-400/15 bg-black">
                  <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} ref={mapRef}>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* User marker uses obfuscated display location — real location is never shown */}
                    {displayLocation && (
                      <Marker position={[displayLocation.lat, displayLocation.lon]} icon={userLocationIcon}>
                        <Popup>Your approximate area (offset for privacy)</Popup>
                      </Marker>
                    )}

                    {mapItems.map((item) =>
                      item.latitude && item.longitude ? (
                        <Marker key={item.id} position={[item.latitude, item.longitude]}>
                          <Popup>
                            <div className="min-w-[190px]">
                              {getImage(item) ? (
                                <img src={getImage(item) || ''} alt={item.title} className="mb-2 h-24 w-full rounded-lg object-cover" />
                              ) : (
                                <div className="mb-2 flex h-24 w-full items-center justify-center rounded-lg bg-slate-800">
                                  <ShoppingBag className="h-8 w-8 text-slate-500" />
                                </div>
                              )}
                              <p className="font-bold">{item.title}</p>
                              <p>{getPriceDisplay(item)}</p>
                              <p className="text-xs">{item.city}, {item.state}</p>
                              {displayLocation && (
                                <p className="text-xs">
                                  {kmToMiles(calculateDistance(displayLocation.lat, displayLocation.lon, item.latitude, item.longitude)).toFixed(2)} miles away
                                </p>
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      ) : null
                    )}

                    {displayLocation && <RecenterControl location={displayLocation} />}
                  </MapContainer>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {messageModal.open && (
        <Modal title="Send Message" onClose={() => { setMessageModal({ open: false }); setMessageText('') }}>
          <textarea
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder="Write your message..."
            className="min-h-[140px] w-full rounded-2xl border border-cyan-400/20 bg-black/40 p-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => { setMessageModal({ open: false }); setMessageText('') }} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-300 hover:bg-white/10">
              Cancel
            </button>
            <button onClick={handleSendMessage} disabled={sendingMessage || !messageText.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-50">
              {sendingMessage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </button>
          </div>
        </Modal>
      )}

      {premiumModal.open && (
        <Modal title="Boost Listing" onClose={() => setPremiumModal({ open: false })}>
          <p className="mb-4 text-sm text-slate-400">Premium boosts last for 7 days.</p>
          <div className="space-y-3">
            {Object.entries(PREMIUM_FEATURES).map(([key, feature]) => (
              <button
                key={key}
                onClick={() => handlePurchasePremium(key as keyof typeof PREMIUM_FEATURES)}
                disabled={purchasingPremium}
                className="flex w-full items-center gap-4 rounded-2xl border border-yellow-400/15 bg-yellow-500/10 p-4 text-left transition hover:bg-yellow-500/20 disabled:opacity-50"
              >
                <span className="text-2xl">{feature.icon}</span>
                <span className="flex-1">
                  <span className="block font-black text-white">{feature.label}</span>
                  <span className="block text-xs text-slate-400">{feature.description}</span>
                </span>
                <span className="font-black text-yellow-300">{feature.cost} coins</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {itemDetail.open && itemDetail.item && (
        <Modal title="Listing Details" size="lg" onClose={() => setItemDetail({ open: false })}>
          <div className="space-y-5">
            <div className="aspect-video overflow-hidden rounded-[1.5rem] border border-cyan-400/15 bg-black/40">
              {getImage(itemDetail.item) ? (
                <img src={getImage(itemDetail.item) || ''} alt={itemDetail.item.title} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="h-16 w-16 text-slate-600" />
                </div>
              )}
            </div>

            <PremiumBadges item={itemDetail.item} large />

            <div>
              <h2 className="text-2xl font-black text-white">{itemDetail.item.title}</h2>
              <p className="mt-2 text-xl font-black text-cyan-300">{getPriceDisplay(itemDetail.item)}</p>
            </div>

            {itemDetail.item.description && (
              <div>
                <p className="mb-1 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Description</p>
                <p className="text-sm leading-6 text-slate-300">{itemDetail.item.description}</p>
              </div>
            )}

            <div className="rounded-2xl border border-cyan-400/10 bg-black/30 p-4">
              <p className="flex items-center gap-2 text-sm text-slate-300">
                <MapPin className="h-4 w-4 text-cyan-300" />
                {itemDetail.item.city}, {itemDetail.item.state}
              </p>
              <p className="mt-1 text-xs text-slate-500">Exact location is hidden for user safety.</p>
            </div>

            <p className="text-sm text-slate-400">Seller: @{getSellerName(itemDetail.item)}</p>

            <div className="grid gap-3 md:grid-cols-3">
              <button
                onClick={() => {
                  setItemDetail({ open: false })
                  openMessageModal(getSellerId(itemDetail.item!), itemDetail.item!.id, activeTab)
                }}
                className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
              >
                Message Seller
              </button>

              <button
                onClick={() => {
                  const buyMessage = `Hi, I'm interested in buying "${itemDetail.item?.title}". Is it still available?`
                  setMessageText(buyMessage)
                  setItemDetail({ open: false })
                  openMessageModal(getSellerId(itemDetail.item!), itemDetail.item!.id, activeTab)
                }}
                className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-200 hover:bg-emerald-500/20"
              >
                Buy
              </button>

              <button
                onClick={() => openPremiumModal(itemDetail.item!.id, activeTab)}
                className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 px-4 py-3 text-sm font-black text-yellow-200 hover:bg-yellow-500/20"
              >
                Boost
              </button>
            </div>
          </div>
        </Modal>
      )}

      {createModal.open && (
        <Modal title="Create Listing" size="lg" onClose={() => setCreateModal({ open: false, type: 'marketplace' })}>
          <div className="space-y-4">
            <FormInput label="Title" value={createForm.title} onChange={(value) => setCreateForm((prev) => ({ ...prev, title: value }))} placeholder="What are you selling?" />
            <FormTextArea label="Description" value={createForm.description} onChange={(value) => setCreateForm((prev) => ({ ...prev, description: value }))} placeholder="Describe your item..." />

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-300">Category</label>
              <select
                value={createForm.category}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, category: event.target.value }))}
                className="w-full rounded-2xl border border-cyan-400/20 bg-black/40 px-4 py-3 text-white outline-none focus:border-cyan-300/60"
              >
                <option value="">Select a category</option>
                {MARKETPLACE_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInput label="Price Coins" value={createForm.price_coins} onChange={(value) => setCreateForm((prev) => ({ ...prev, price_coins: value }))} placeholder="0" type="number" />
              <FormInput label="Price USD" value={createForm.price_usd} onChange={(value) => setCreateForm((prev) => ({ ...prev, price_usd: value }))} placeholder="0.00" type="number" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormInput label="City" value={createForm.city} onChange={(value) => setCreateForm((prev) => ({ ...prev, city: value }))} placeholder="City" />
              <FormInput label="State" value={createForm.state} onChange={(value) => setCreateForm((prev) => ({ ...prev, state: value }))} placeholder="State" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-300">Condition</label>
                <select
                  value={createForm.condition}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, condition: event.target.value }))}
                  className="w-full rounded-2xl border border-cyan-400/20 bg-black/40 px-4 py-3 text-white outline-none focus:border-cyan-300/60"
                >
                  <option value="new">New</option>
                  <option value="like_new">Like New</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-300">Delivery</label>
                <select
                  value={createForm.delivery_type}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, delivery_type: event.target.value }))}
                  className="w-full rounded-2xl border border-cyan-400/20 bg-black/40 px-4 py-3 text-white outline-none focus:border-cyan-300/60"
                >
                  <option value="shipping">Shipping Only</option>
                  <option value="pickup">Pickup Only</option>
                  <option value="both">Shipping or Pickup</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold text-slate-300">Images</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(event) => {
                  setCreateForm((prev) => ({
                    ...prev,
                    images: Array.from(event.target.files || []).slice(0, 5),
                  }))
                }}
                className="w-full rounded-2xl border border-cyan-400/20 bg-black/40 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:text-sm file:font-black file:text-slate-950"
              />
              <p className="mt-1 text-xs text-slate-500">Upload up to 5 images. Location will be offset for safety.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => setCreateModal({ open: false, type: 'marketplace' })} disabled={creating} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-slate-300 hover:bg-white/10 disabled:opacity-50">
                Cancel
              </button>

              <button onClick={handleCreateListing} disabled={creating} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-50">
                {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, pink }: { icon: any; label: string; value: string | number; pink?: boolean }) {
  return (
    <div className={`rounded-3xl border p-4 ${pink ? 'border-pink-400/20 bg-pink-500/5' : 'border-cyan-400/20 bg-cyan-500/5'}`}>
      <Icon className={`mb-3 h-5 w-5 ${pink ? 'text-pink-300' : 'text-cyan-300'}`} />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  )
}

function TabButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${active ? 'bg-cyan-400 text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.28)]' : 'border border-cyan-400/10 bg-white/[0.03] text-slate-400 hover:border-cyan-400/30 hover:text-white'}`}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function CategoryPill({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition ${active ? 'border-cyan-300/30 bg-cyan-400 text-slate-950' : 'border-cyan-400/10 bg-black/30 text-slate-400 hover:border-cyan-400/30 hover:text-white'}`}>
      <span>{icon}</span>
      {label}
    </button>
  )
}

function ListingCard({
  item,
  activeTab,
  userId,
  getImage,
  getPriceDisplay,
  formatDate,
  getSellerId,
  onOpen,
  onMessage,
  onBuy,
  onBoost,
}: {
  item: BaseListing
  activeTab: ActiveTab
  userId?: string
  getImage: (item: BaseListing) => string | null
  getPriceDisplay: (item: BaseListing) => string
  formatDate: (date: string) => string
  getSellerId: (item: BaseListing) => string | undefined
  onOpen: () => void
  onMessage: () => void
  onBuy: () => void
  onBoost: () => void
}) {
  const image = getImage(item)
  const sellerId = getSellerId(item)
  const isOwner = userId && sellerId === userId

  return (
    <article onClick={onOpen} className={`group cursor-pointer overflow-hidden rounded-[2rem] border bg-slate-950/75 shadow-[0_0_40px_rgba(34,211,238,0.08)] backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-300/40 hover:shadow-[0_0_60px_rgba(34,211,238,0.15)] ${item.is_highlighted ? 'border-yellow-300/50' : item.is_pinned ? 'border-red-400/40' : item.is_featured ? 'border-yellow-400/35' : 'border-cyan-400/15'}`}>
      <div className="relative aspect-video overflow-hidden bg-black/40">
        {image ? (
          <img src={image} alt={item.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-12 w-12 text-slate-600" />
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1">
          <PremiumBadges item={item} />
          {item.is_shop_item && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
              🏪 Shop
            </span>
          )}
        </div>

        {item.condition && (
          <span className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-black capitalize text-white">
            {item.condition.replace('_', ' ')}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="line-clamp-1 text-lg font-black text-white">{item.title}</h3>

        {item.business_name && <p className="mt-1 text-sm font-bold text-cyan-300">{item.business_name}</p>}
        {item.make && item.model && <p className="mt-1 text-sm text-slate-400">{item.year} {item.make} {item.model}</p>}
        {item.description && <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">{item.description}</p>}

        <p className="mt-4 text-lg font-black text-cyan-300">
          <Coins className="mr-1 inline h-4 w-4" />
          {getPriceDisplay(item)}
        </p>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span className="flex min-w-0 items-center gap-1 truncate">
            {item.is_shop_item ? (
              <>
                <Store className="h-3 w-3 shrink-0" />
                {item.shop_name || 'Shop Item'}
              </>
            ) : item.city ? (
              <>
                <MapPin className="h-3 w-3 shrink-0" />
                {item.city}, {item.state}
              </>
            ) : (
              <span className="text-slate-600">Location hidden</span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(item.created_at)}
          </span>
        </div>

        {item.business_rating && (
          <div className="mt-3 flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-300 text-yellow-300" />
            <span className="text-sm font-black text-white">{item.business_rating.toFixed(1)}</span>
            <span className="text-xs text-slate-500">({item.total_reviews || 0})</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-[1fr_auto_auto_auto] gap-2">
          <button onClick={(event) => { event.stopPropagation(); onMessage() }} className="inline-flex items-center justify-center gap-1 rounded-xl bg-cyan-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-cyan-300">
            <MessageCircle className="h-4 w-4" />
            Message
          </button>

          {!isOwner && (
            <button onClick={(event) => { event.stopPropagation(); onBuy() }} className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-emerald-200 hover:bg-emerald-500/20">
              <DollarSign className="h-4 w-4" />
            </button>
          )}

          <button onClick={(event) => { event.stopPropagation(); onBoost() }} className="rounded-xl border border-yellow-400/20 bg-yellow-500/10 px-3 py-2 text-yellow-200 hover:bg-yellow-500/20">
            <Zap className="h-4 w-4" />
          </button>

          {activeTab !== 'services' && (
            <button onClick={(event) => event.stopPropagation()} className="rounded-xl border border-pink-400/20 bg-pink-500/10 px-3 py-2 text-pink-200 hover:bg-pink-500/20">
              <Heart className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function PremiumBadges({ item, large }: { item: BaseListing; large?: boolean }) {
  const cls = large ? 'px-3 py-1 text-sm' : 'px-2 py-1 text-[10px]'

  return (
    <div className="flex flex-wrap gap-1">
      {item.is_pinned && <span className={`${cls} inline-flex items-center gap-1 rounded-full bg-red-500 font-black text-white`}><Pin className="h-3 w-3" />Pinned</span>}
      {item.is_featured && <span className={`${cls} inline-flex items-center gap-1 rounded-full bg-yellow-400 font-black text-black`}><Star className="h-3 w-3" />Featured</span>}
      {item.is_highlighted && <span className={`${cls} inline-flex items-center gap-1 rounded-full bg-cyan-400 font-black text-slate-950`}><Palette className="h-3 w-3" />Glow</span>}
      {item.is_auto_promo && <span className={`${cls} inline-flex items-center gap-1 rounded-full bg-fuchsia-500 font-black text-white`}><Tv className="h-3 w-3" />Auto</span>}
    </div>
  )
}

function SkeletonGrid() {
  return (
    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="rounded-[2rem] border border-cyan-400/10 bg-slate-950/75 p-4">
          <div className="mb-4 aspect-video animate-pulse rounded-2xl bg-cyan-400/10" />
          <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-cyan-400/10" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-cyan-400/10" />
        </div>
      ))}
    </section>
  )
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <section className="flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] border border-cyan-400/10 bg-slate-950/60 px-6 text-center">
      <Search className="mb-5 h-16 w-16 text-slate-600" />
      <h2 className="text-2xl font-black text-white">No Listings Found</h2>
      <p className="mt-2 text-sm text-slate-400">Try another search or clear your filters.</p>
      <button onClick={onClear} className="mt-5 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300">
        Clear Filters
      </button>
    </section>
  )
}

function Modal({ title, children, onClose, size = 'md' }: { title: string; children: React.ReactNode; onClose: () => void; size?: 'md' | 'lg' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl">
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-[2rem] border border-cyan-400/20 bg-slate-950/95 p-6 shadow-[0_0_70px_rgba(34,211,238,0.14)] ${size === 'lg' ? 'max-w-3xl' : 'max-w-md'}`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-xl font-black text-white">{title}</h3>
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormInput({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold text-slate-300">{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-2xl border border-cyan-400/20 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60" />
    </div>
  )
}

function FormTextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-bold text-slate-300">{label}</label>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} className="w-full resize-none rounded-2xl border border-cyan-400/20 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60" />
    </div>
  )
}