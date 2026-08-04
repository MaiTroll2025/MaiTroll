import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Wrench, Loader2, AlertTriangle } from 'lucide-react'

interface ServiceListingFormProps {
  user: any
  businessId?: string
  onListingCreated?: () => void
}

const PRICE_TYPES = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'hourly', label: 'Hourly Rate' },
  { value: 'quote', label: 'Custom Quote' },
  { value: 'free', label: 'Free' },
]

const SERVICE_CATEGORIES = [
  'tutoring', 'repairs', 'cleaning', 'delivery', 'transport',
  'entertainment', 'tech_support', 'design', 'consulting', 'other'
]

export default function ServiceListingForm({ user, businessId, onListingCreated }: ServiceListingFormProps) {
  const [submitting, setSubmitting] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [priceType, setPriceType] = useState('quote')
  const [priceCoins, setPriceCoins] = useState('')
  const [priceUsd, setPriceUsd] = useState('')
  const [isRemote, setIsRemote] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setCategory('')
    setSubcategory('')
    setPriceType('quote')
    setPriceCoins('')
    setPriceUsd('')
    setIsRemote(false)
    setDurationMinutes('')
    setCity('')
    setState('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) return toast.error('Service title is required')
    if (!description.trim()) return toast.error('Description is required')
    if (!businessId) return toast.error('You need a business profile first. Create one in the "My Business" tab.')

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('service_listings')
        .insert([{
          business_id: businessId,
          title: title.trim(),
          description: description.trim(),
          category: category || null,
          subcategory: subcategory.trim() || null,
          price_type: priceType,
          price_coins: priceCoins ? parseInt(priceCoins) : null,
          price_usd: priceUsd ? parseFloat(priceUsd) : null,
          is_remote: isRemote,
          duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
          city: city.trim() || null,
          state: state.trim() || null,
          status: 'active',
        }])

      if (error) throw error

      toast.success('Service listing created successfully!')
      resetForm()
      onListingCreated?.()
    } catch (err: any) {
      console.error('Service listing error:', err)
      toast.error(err.message || 'Failed to create service listing')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!businessId && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-yellow-400 font-semibold text-sm">Business Profile Required</p>
            <p className="text-gray-300 text-sm mt-1">
              You must create a business profile first in the &quot;My Business&quot; tab before adding service listings.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">Service Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. Home Cleaning Service"
            required
            disabled={!businessId}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white resize-none h-28"
            placeholder="Describe your service in detail..."
            required
            disabled={!businessId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            disabled={!businessId}
          >
            <option value="">Select category</option>
            {SERVICE_CATEGORIES.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Subcategory</label>
          <input
            type="text"
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. Deep cleaning"
            disabled={!businessId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Pricing Type</label>
          <select
            value={priceType}
            onChange={(e) => setPriceType(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            disabled={!businessId}
          >
            {PRICE_TYPES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Duration (minutes)</label>
          <input
            type="number"
            min="0"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. 60"
            disabled={!businessId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Price (Troll Coins)</label>
          <input
            type="number"
            min="0"
            value={priceCoins}
            onChange={(e) => setPriceCoins(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. 5000"
            disabled={!businessId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Price (USD)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={priceUsd}
            onChange={(e) => setPriceUsd(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. 50.00"
            disabled={!businessId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">City</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. Mai Troll"
            disabled={!businessId}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">State</label>
          <input
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. TC"
            disabled={!businessId}
          />
        </div>

        <div className="md:col-span-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isRemote}
              onChange={(e) => setIsRemote(e.target.checked)}
              className="w-5 h-5 rounded bg-[#0D0D0D] border-[#2C2C2C] text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
              disabled={!businessId}
            />
            <span className="text-sm text-gray-300">This service can be performed remotely</span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !businessId}
        className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating Service...
          </>
        ) : (
          <>
            <Wrench className="w-4 h-4" />
            Create Service Listing
          </>
        )}
      </button>
    </form>
  )
}
