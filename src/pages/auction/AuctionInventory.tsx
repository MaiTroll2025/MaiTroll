import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ImagePlus, Loader2, Package, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { validateFile, FILE_VALIDATION } from '../../lib/fileValidation'
import { cn } from '../../lib/utils'
import { generateBarcodeDataURL } from '../../lib/barcode'

import AuctionNav from './AuctionNav'

interface InventoryItem {
  id: string
  title: string
  description: string | null
  image_url: string | null
  category: string | null
  condition: string
  quantity: number
  estimated_value: number | null
  status: 'available' | 'in_show' | 'sold' | 'removed'
  created_at: string
  show_title?: string | null
}

const CATEGORIES = [
  'Electronics',
  'Pro Audio',
  'Smart Home',
  'Gaming',
  'Computers',
  'Cameras',
  'Collectibles',
  'Art',
  'Home & Garden',
  'Sports',
  'Toys & Games',
  'Vehicles',
  'Books',
  'Other',
]

const CONDITIONS = ['New', 'Like New', 'Excellent', 'Good', 'Fair', 'Used', 'For Parts']

const shell =
  'relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#07101f] px-3 pb-8 pt-20 text-white sm:px-4 md:px-6'
const panel =
  'rounded-[1.65rem] border border-cyan-300/15 bg-[#0b1628]/85 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const _panelSoft =
  'rounded-[1.4rem] border border-cyan-300/12 bg-[#0d1a2f]/78 shadow-[0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-xl'
const input =
  'w-full rounded-xl border border-cyan-300/20 bg-[#07101f]/85 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15'
const primary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.28)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50'
const secondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/18 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
const danger =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-red-300/25 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-100 transition hover:bg-red-500/20'

function formatCoins(value: number | null | undefined) {
  return Number(value || 0).toLocaleString()
}

export default function AuctionInventory() {
  const { user } = useAuthStore()

  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, _setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showCreator, setShowCreator] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [shows, setShows] = useState<{ id: string; title: string }[]>([])

  const [form, setForm] = useState({
    title: '',
    description: '',
    image_url: '',
    category: 'Electronics',
    condition: 'Good',
    quantity: 1,
    estimated_value: 0,
    auction_show_id: '',
  })

  const fetchInventory = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      // Get all lots across all shows for this auctioneer
      const { data: auctioneer } = await supabase
        .from('auctioneer_profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!auctioneer?.id) {
        setLoading(false)
        return
      }

      const { data: showsData } = await supabase
        .from('auction_shows')
        .select('id, title')
        .eq('auctioneer_id', auctioneer.id)
        .order('created_at', { ascending: false })

      setShows(showsData || [])

      const showIds = (showsData || []).map((s) => s.id)
      const showMap = new Map((showsData || []).map((s) => [s.id, s.title]))

      if (showIds.length === 0) {
        setItems([])
        setLoading(false)
        return
      }

      const { data: lots } = await supabase
        .from('auction_lots')
        .select('*')
        .in('auction_show_id', showIds)
        .order('created_at', { ascending: false })

      const inventoryItems: InventoryItem[] = (lots || []).map((lot) => ({
        id: lot.id,
        title: lot.title,
        description: lot.description,
        image_url: lot.image_url,
        category: null,
        condition: lot.condition || 'Good',
        quantity: lot.quantity || 1,
        estimated_value: lot.starting_bid,
        status: lot.status === 'removed' ? 'removed' : lot.status === 'sold' ? 'sold' : lot.status === 'live' ? 'in_show' : 'available',
        created_at: lot.created_at,
        show_title: showMap.get(lot.auction_show_id) || null,
      }))

      setItems(inventoryItems)
    } catch (error: any) {
      console.error('[AuctionInventory] Error:', error)
      toast.error('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchInventory()
  }, [fetchInventory])

  const filteredItems = useMemo(() => {
    let result = items

    if (filterStatus !== 'all') {
      result = result.filter((i) => i.status === filterStatus)
    }

    if (filterCategory !== 'all') {
      result = result.filter((i) => i.category === filterCategory)
    }

    const query = searchQuery.trim().toLowerCase()
    if (query) {
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(query) ||
          i.description?.toLowerCase().includes(query)
      )
    }

    return result
  }, [items, filterStatus, filterCategory, searchQuery])

  const stats = useMemo(() => {
    return {
      total: items.length,
      available: items.filter((i) => i.status === 'available').length,
      inShow: items.filter((i) => i.status === 'in_show').length,
      sold: items.filter((i) => i.status === 'sold').length,
      totalValue: items.reduce((sum, i) => sum + (i.estimated_value || 0), 0),
    }
  }, [items])

  const uploadImage = async (file: File) => {
    if (!user?.id) return

    const validation = validateFile(file, FILE_VALIDATION.image.types, FILE_VALIDATION.image.maxSize, 'Image')
    if (!validation.valid) {
      toast.error(validation.error!)
      return
    }

    setUploadingImage(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('auction-items').upload(path, file, {
        upsert: false,
        contentType: file.type,
      })
      if (error) throw error
      const { data } = supabase.storage.from('auction-items').getPublicUrl(path)
      setForm((prev) => ({ ...prev, image_url: data.publicUrl }))
      toast.success('Image uploaded')
    } catch (_error: any) {
      toast.error('Image upload failed')
    } finally {
      setUploadingImage(false)
    }
  }

  const deleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase.from('auction_lots').update({ status: 'removed' }).eq('id', itemId)
      if (error) throw error
      toast.success('Item removed')
      await fetchInventory()
    } catch {
      toast.error('Failed to remove item')
    }
  }

  const deleteAllItems = async () => {
    const deletableIds = filteredItems.filter((i) => i.status !== 'removed').map((i) => i.id)
    if (deletableIds.length === 0) return
    try {
      const { error } = await supabase
        .from('auction_lots')
        .update({ status: 'removed' })
        .in('id', deletableIds)
      if (error) throw error
      toast.success(`Removed ${deletableIds.length} item${deletableIds.length > 1 ? 's' : ''}`)
      await fetchInventory()
    } catch {
      toast.error('Failed to remove items')
    }
  }

  const addItem = async () => {
    if (!form.title.trim()) return toast.error('Item title is required')
    if (Number(form.estimated_value) < 100) return toast.error('Estimated value must be at least 100 coins')
    if (!form.auction_show_id) return toast.error('Select a show to assign this item to')

    try {
      const { data: maxPos } = await supabase
        .from('auction_lots')
        .select('queue_position')
        .eq('auction_show_id', form.auction_show_id)
        .order('queue_position', { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextPosition = (maxPos?.queue_position ?? 0) + 1

      const payload = {
        auction_show_id: form.auction_show_id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        starting_bid: Number(form.estimated_value),
        quantity: Number(form.quantity || 1),
        condition: form.condition,
        status: 'queued',
        queue_position: nextPosition,
      }

      const { data, error } = await supabase.from('auction_lots').insert(payload).select('id').single()
      if (error) throw error

      toast.success('Item added to show queue')
      setShowCreator(false)
      setForm({
        title: '',
        description: '',
        image_url: '',
        category: 'Electronics',
        condition: 'Good',
        quantity: 1,
        estimated_value: 0,
        auction_show_id: '',
      })
      await fetchInventory()

      if (data?.id) {
        const start = Date.now()
        const wait = async () => {
          const { data: lot } = await supabase
            .from('auction_lots')
            .select('*')
            .eq('id', data.id)
            .single()
          if (lot?.barcode && lot?.lot_number) {
            const show = shows.find(s => s.id === form.auction_show_id)
            const dataURL = generateBarcodeDataURL(lot.barcode)
            const printWindow = window.open('', '_blank', 'width=400,height=600')
            if (!printWindow) {
              toast.error('Pop-up blocked. Allow pop-ups to print labels.')
              return
            }
            printWindow.document.write(`
              <html>
                <head>
                  <title>Print Label</title>
                  <style>
                    @page { size: 2.4in 1in; margin: 0; }
                    body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; font-family: Arial, sans-serif; }
                    .label { width: 2.4in; height: 1in; border: 2px solid #000; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                    .label img { max-width: 90%; max-height: 55%; }
                    .label p { margin: 2px 0; font-size: 14px; font-weight: bold; text-align: center; }
                    .label .meta { font-size: 10px; color: #333; }
                  </style>
                </head>
                <body>
                  <div class="label">
                    <img src="${dataURL}" alt="${lot.barcode}" />
                    <p>${lot.barcode}</p>
                    <p class="meta">${lot.title} · ${show?.title || ''}</p>
                  </div>
                </body>
              </html>
            `)
            printWindow.document.close()
            printWindow.focus()
            setTimeout(() => {
              printWindow.print()
            }, 300)
          } else if (Date.now() - start < 3000) {
            setTimeout(wait, 200)
          } else {
            toast.error('Barcode not ready yet')
          }
        }
        void wait()
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add item')
    }
  }

  return (
    <div className={shell}>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_32%),radial-gradient(circle_at_75%_20%,rgba(59,130,246,0.12),transparent_26%)]" />

      <main className="relative z-10 mx-auto max-w-[1400px] space-y-4">
        <AuctionNav active="inventory" />

        {/* Header */}
        <header className={cn(panel, 'overflow-hidden p-5')}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-black text-white md:text-4xl">Inventory</h1>
              <p className="mt-1 text-sm text-slate-400">
                All your auction items across every show. Add, assign, and manage your stock.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Items</p>
                <p className="text-2xl font-black text-cyan-100">{stats.total}</p>
              </div>
              <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/5 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sold</p>
                <p className="text-2xl font-black text-emerald-200">{stats.sold}</p>
              </div>
              <div className="rounded-xl border border-amber-300/15 bg-amber-400/5 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Est. Value</p>
                <p className="text-2xl font-black text-amber-200">{formatCoins(stats.totalValue)}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => setShowCreator(true)} className={primary}>
              <Plus className="h-4 w-4" />
              Add Item
            </button>
            {filteredItems.filter((i) => i.status !== 'removed').length > 0 && (
              <button onClick={() => void deleteAllItems()} className={danger}>
                <Trash2 className="h-4 w-4" />
                Delete All ({filteredItems.filter((i) => i.status !== 'removed').length})
              </button>
            )}
          </div>
        </header>

        {/* Toolbar */}
        <div className={cn(panel, 'p-4')}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search inventory..."
                className={cn(input, 'pl-10')}
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={cn(input, 'w-full sm:w-44')}
            >
              <option value="all" className="bg-slate-950">All Status</option>
              <option value="available" className="bg-slate-950">Available</option>
              <option value="in_show" className="bg-slate-950">In Show</option>
              <option value="sold" className="bg-slate-950">Sold</option>
            </select>
          </div>
        </div>

        {/* Items grid */}
        <div className={cn(panel, 'p-4')}>
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex min-h-[300px] items-center justify-center text-center">
              <div>
                <Package className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                <p className="font-black text-white">No items found</p>
                <p className="mt-2 text-sm text-slate-500">
                  Create a show and add items to see them here.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-cyan-300/15"
                >
                  <div className="mb-3 h-32 overflow-hidden rounded-xl border border-white/10 bg-[#07101f]">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-10 w-10 text-slate-600" />
                      </div>
                    )}
                  </div>

                  <h3 className="truncate font-black text-white">{item.title}</h3>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">{item.description || 'No description'}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-slate-400">
                      Est: <span className="text-cyan-200">{formatCoins(item.estimated_value)}</span>
                    </span>
                    <span className="font-bold text-slate-400">
                      Qty: <span className="text-amber-300">{item.quantity}</span>
                    </span>
                    <span className="font-bold text-slate-400">
                      Cond: <span className="text-emerald-300">{item.condition}</span>
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-2">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-black uppercase',
                        item.status === 'sold'
                          ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
                          : item.status === 'in_show'
                          ? 'border-cyan-300/25 bg-cyan-400/10 text-cyan-100'
                          : item.status === 'available'
                          ? 'border-white/10 bg-white/5 text-slate-300'
                          : 'border-red-300/25 bg-red-500/10 text-red-100'
                      )}
                    >
                      {item.status === 'in_show' ? 'In Show' : item.status}
                    </span>

                    {item.show_title && (
                      <span className="truncate text-[10px] text-slate-500">{item.show_title}</span>
                    )}

                    {item.status !== 'removed' && (
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-300/20 bg-red-500/8 px-2.5 py-1.5 text-[10px] font-bold text-red-200 transition hover:border-red-300/35 hover:bg-red-500/20"
                        title="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showCreator && (
        <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className={cn(panel, 'max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6')}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Inventory</p>
                <h2 className="mt-1 text-2xl font-black text-white">Add Inventory Item</h2>
              </div>
              <button
                onClick={() => setShowCreator(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-300/25 bg-red-500/10 text-red-100 transition hover:bg-red-500/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Show assignment */}
              <div>
                <label className="mb-2 block text-sm font-black text-cyan-100">Assign to Show *</label>
                <select
                  className={input}
                  value={form.auction_show_id}
                  onChange={(e) => setForm({ ...form, auction_show_id: e.target.value })}
                >
                  <option value="" className="bg-slate-950">Select a show...</option>
                  {shows.map((show) => (
                    <option key={show.id} value={show.id} className="bg-slate-950">
                      {show.title}
                    </option>
                  ))}
                </select>
                {shows.length === 0 && (
                  <p className="mt-2 text-xs text-amber-400">No shows found. Create an auction show first.</p>
                )}
              </div>

              {/* Image upload */}
              <div>
                <label className="mb-2 block text-sm font-black text-cyan-100">Item Image</label>
                <div className="rounded-2xl border border-cyan-300/15 bg-[#07101f]/75 p-4">
                  {form.image_url ? (
                    <img src={form.image_url} alt="Preview" className="mb-3 h-44 w-full rounded-xl object-cover" />
                  ) : (
                    <div className="mb-3 flex h-44 items-center justify-center rounded-xl border border-dashed border-cyan-300/25 bg-cyan-400/5">
                      <div className="text-center">
                        <ImagePlus className="mx-auto mb-2 h-10 w-10 text-cyan-300/50" />
                        <p className="text-xs font-bold text-slate-500">Upload a product image</p>
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void uploadImage(file)
                    }}
                    className="hidden"
                    id="inventory-item-upload"
                  />
                  <label htmlFor="inventory-item-upload" className={cn(secondary, 'w-full cursor-pointer')}>
                    {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploadingImage ? 'Uploading...' : 'Upload Image'}
                  </label>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="mb-2 block text-sm font-black text-cyan-100">Item Title *</label>
                <input
                  className={input}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="ASUS gaming laptop, Sony camera..."
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-2 block text-sm font-black text-cyan-100">Description</label>
                <textarea
                  className={cn(input, 'h-24 resize-none')}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Add specs, condition details, model number..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Estimated Value */}
                <div>
                  <label className="mb-2 block text-sm font-black text-cyan-100">Estimated Value (coins) *</label>
                  <input
                    type="number"
                    className={input}
                    value={form.estimated_value}
                    onChange={(e) => setForm({ ...form, estimated_value: Number(e.target.value) })}
                    placeholder="100"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label className="mb-2 block text-sm font-black text-cyan-100">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    className={input}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  />
                </div>

                {/* Condition */}
                <div>
                  <label className="mb-2 block text-sm font-black text-cyan-100">Condition</label>
                  <select
                    className={input}
                    value={form.condition}
                    onChange={(e) => setForm({ ...form, condition: e.target.value })}
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c} className="bg-slate-950">{c}</option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="mb-2 block text-sm font-black text-cyan-100">Category</label>
                  <select
                    className={input}
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-slate-950">{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => void addItem()}
                disabled={!form.auction_show_id || !form.title.trim()}
                className={cn(primary, 'w-full')}
              >
                <Plus className="h-4 w-4" />
                Add Item to Show
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
