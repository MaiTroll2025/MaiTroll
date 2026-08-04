import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Store, Loader2 } from 'lucide-react'

interface BusinessProfileFormProps {
  user: any
  existingProfile?: any
  onProfileCreated?: (profile: any) => void
}

const BUSINESS_CATEGORIES = [
  'mechanic',
  'repair',
  'detailing',
  'inspection',
  'parts',
  'consulting',
  'sales',
  'contractor',
  'other',
]

export default function BusinessProfileForm({ user, existingProfile, onProfileCreated }: BusinessProfileFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [businessName, setBusinessName] = useState(existingProfile?.business_name || '')
  const [description, setDescription] = useState(existingProfile?.description || '')
  const [category, setCategory] = useState(existingProfile?.category || '')
  const [phone, setPhone] = useState(existingProfile?.phone || '')
  const [email, setEmail] = useState(existingProfile?.email || '')
  const [website, setWebsite] = useState(existingProfile?.website || '')
  const [address, setAddress] = useState(existingProfile?.address || '')
  const [city, setCity] = useState(existingProfile?.city || '')
  const [state, setState] = useState(existingProfile?.state || '')

  useEffect(() => {
    if (!existingProfile?.id) return
    setBusinessName(existingProfile.business_name || '')
    setDescription(existingProfile.description || '')
    setCategory(existingProfile.category || '')
    setPhone(existingProfile.phone || '')
    setEmail(existingProfile.email || '')
    setWebsite(existingProfile.website || '')
    setAddress(existingProfile.address || '')
    setCity(existingProfile.city || '')
    setState(existingProfile.state || '')
  }, [existingProfile?.id])

  const resetForm = () => {
    setBusinessName('')
    setDescription('')
    setCategory('')
    setPhone('')
    setEmail('')
    setWebsite('')
    setAddress('')
    setCity('')
    setState('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!businessName.trim()) return toast.error('Business name is required')
    if (!email.trim()) return toast.error('Contact email is required')

    setSubmitting(true)
    try {
      const payload = {
        owner_id: user.id,
        business_name: businessName.trim(),
        description: description.trim() || null,
        category: category || null,
        phone: phone.trim() || null,
        email: email.trim(),
        website: website.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        status: 'active',
      }

      let data: any = null
      let error: any = null

      if (existingProfile?.id) {
        const response = await supabase
          .from('business_profiles')
          .update(payload)
          .eq('id', existingProfile.id)
          .select('*')
          .maybeSingle()

        data = response.data
        error = response.error
      } else {
        const response = await supabase
          .from('business_profiles')
          .insert([payload])
          .select('*')
          .maybeSingle()

        data = response.data
        error = response.error
      }

      if (error) throw error
      toast.success(existingProfile ? 'Business profile updated' : 'Business profile created successfully!')
      onProfileCreated?.(data)
      if (!existingProfile) resetForm()
    } catch (err: any) {
      console.error('Business profile error:', err)
      toast.error(err.message || 'Failed to save business profile')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-5">
        <h3 className="font-semibold text-blue-300 text-base mb-2">Business Profile Details</h3>
        <p className="text-gray-300 text-sm">
          Create or update your business profile so customers can discover your service listings in Trollifieds.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">Business Name *</label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. Mai Troll Auto Mechanics"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white resize-none h-28"
            placeholder="Describe your business and services..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
          >
            <option value="">Select category</option>
            {BUSINESS_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item.charAt(0).toUpperCase() + item.slice(1).replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Contact Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="you@business.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. (555) 555-0123"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Website</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="https://yourbusiness.com"
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
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. 123 Troll Ave"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving Business Profile...
          </>
        ) : (
          <>
            <Store className="w-4 h-4" />
            {existingProfile ? 'Update Business Profile' : 'Create Business Profile'}
          </>
        )}
      </button>
    </form>
  )
}
