import React, { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { Car, Upload, FileText, AlertTriangle, CheckCircle, X, Loader2, ExternalLink, Wrench } from 'lucide-react'

interface VehicleListingFormProps {
  user: any
  shopId?: string
  onListingCreated?: () => void
}

const VEHICLE_CONDITIONS = ['new', 'used', 'refurbished']
const BODY_TYPES = ['sedan', 'suv', 'truck', 'coupe', 'hatchback', 'van', 'convertible', 'wagon', 'motorcycle', 'other']
const FUEL_TYPES = ['gasoline', 'diesel', 'electric', 'hybrid', 'plugin_hybrid', 'other']
const TRANSMISSION_TYPES = ['automatic', 'manual', 'cvt', 'other']
const PHOTO_CATEGORIES = [
  { key: 'front_bumper', label: 'Front bumper' },
  { key: 'hood', label: 'Hood' },
  { key: 'engine_bay', label: 'Engine bay' },
  { key: 'right_side', label: 'Right side' },
  { key: 'left_side', label: 'Left side' },
  { key: 'rear_bumper', label: 'Rear bumper' },
  { key: 'tire_tread', label: 'Tire tread' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'odometer', label: 'Odometer reading' },
  { key: 'interior', label: 'Interior' },
]

export default function VehicleListingForm({ user, shopId, onListingCreated }: VehicleListingFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [vinPdfUrl, setVinPdfUrl] = useState<string | null>(null)
  const [vinPdfName, setVinPdfName] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [mileage, setMileage] = useState('')
  const [vin, setVin] = useState('')
  const [condition, setCondition] = useState('used')
  const [bodyType, setBodyType] = useState('')
  const [fuelType, setFuelType] = useState('')
  const [transmission, setTransmission] = useState('')
  const [color, setColor] = useState('')
  const [priceCoins, setPriceCoins] = useState('')
  const [priceUsd, setPriceUsd] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>(
    PHOTO_CATEGORIES.reduce((acc, photo) => ({ ...acc, [photo.key]: '' }), {})
  )
  const [photoNames, setPhotoNames] = useState<Record<string, string>>(
    PHOTO_CATEGORIES.reduce((acc, photo) => ({ ...acc, [photo.key]: '' }), {})
  )
  const [photoUploading, setPhotoUploading] = useState<Record<string, boolean>>(
    PHOTO_CATEGORIES.reduce((acc, photo) => ({ ...acc, [photo.key]: false }), {})
  )
  const [problems, setProblems] = useState('')
  const [codes, setCodes] = useState('')
  const [checkEngineLight, setCheckEngineLight] = useState(false)
  const [ceoMechanicVerified, setCeoMechanicVerified] = useState(false)

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setMake('')
    setModel('')
    setYear('')
    setMileage('')
    setVin('')
    setCondition('used')
    setBodyType('')
    setFuelType('')
    setTransmission('')
    setColor('')
    setPriceCoins('')
    setPriceUsd('')
    setCity('')
    setState('')
    setVinPdfUrl(null)
    setVinPdfName(null)
    setPhotoUrls(PHOTO_CATEGORIES.reduce((acc, photo) => ({ ...acc, [photo.key]: '' }), {}))
    setPhotoNames(PHOTO_CATEGORIES.reduce((acc, photo) => ({ ...acc, [photo.key]: '' }), {}))
    setPhotoUploading(PHOTO_CATEGORIES.reduce((acc, photo) => ({ ...acc, [photo.key]: false }), {}))
    setProblems('')
    setCodes('')
    setCheckEngineLight(false)
    setCeoMechanicVerified(false)
  }

  const handlePhotoUpload = useCallback(async (category: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are accepted for vehicle photos')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Each photo must be under 10MB')
      return
    }

    setPhotoUploading((prev) => ({ ...prev, [category]: true }))
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `vehicle-photos/${user.id}/${category}-${Date.now()}-${crypto.randomUUID()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('post-images')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(path)

      setPhotoUrls((prev) => ({ ...prev, [category]: urlData.publicUrl }))
      setPhotoNames((prev) => ({ ...prev, [category]: file.name }))
      toast.success(`${category.replace('_', ' ')} photo uploaded successfully`)
    } catch (err: any) {
      console.error('Vehicle photo upload error:', err)
      toast.error(err.message || 'Failed to upload vehicle photo')
    } finally {
      setPhotoUploading((prev) => ({ ...prev, [category]: false }))
    }
  }, [user.id])

  const removePhoto = (category: string) => {
    setPhotoUrls((prev) => ({ ...prev, [category]: '' }))
    setPhotoNames((prev) => ({ ...prev, [category]: '' }))
  }

  const handleVinPdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are accepted for VIN verification')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('PDF file must be under 10MB')
      return
    }

    setUploadingPdf(true)
    try {
      const ext = 'pdf'
      const path = `vin-verifications/${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('vehicle-documents')
        .upload(path, file, {
          upsert: false,
          contentType: 'application/pdf',
        })

      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage
        .from('vehicle-documents')
        .getPublicUrl(path)

      setVinPdfUrl(urlData.publicUrl)
      setVinPdfName(file.name)
      toast.success('VIN verification PDF uploaded successfully')
    } catch (err: any) {
      console.error('VIN PDF upload error:', err)
      toast.error(err.message || 'Failed to upload VIN verification PDF')
    } finally {
      setUploadingPdf(false)
    }
  }, [user.id])

  const removeVinPdf = () => {
    setVinPdfUrl(null)
    setVinPdfName(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // VIN verification PDF is REQUIRED
    if (!vinPdfUrl) {
      toast.error('VIN verification PDF is required. Please upload your VINCheck® report from NICB.')
      return
    }

    for (const photo of PHOTO_CATEGORIES) {
      if (!photoUrls[photo.key]) {
        return toast.error(`Please upload the required ${photo.label.toLowerCase()} photo.`)
      }
    }

    if (!title.trim()) return toast.error('Vehicle title is required')
    if (!make.trim()) return toast.error('Make is required')
    if (!model.trim()) return toast.error('Model is required')
    if (!year || parseInt(year) < 1900 || parseInt(year) > new Date().getFullYear() + 1) return toast.error('Valid year is required')
    if (!vin.trim()) return toast.error('VIN is required')
    if (vin.trim().length !== 17) return toast.error('VIN must be exactly 17 characters')
    if (!priceCoins && !priceUsd) return toast.error('Price is required')
    if (!problems.trim()) return toast.error('A list of known problems is required')
    if (!codes.trim()) return toast.error('Any diagnostic codes must be documented')
    if (!ceoMechanicVerified) return toast.error('Please confirm that the CEO mechanic will verify this vehicle listing')

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('vehicle_listings')
        .insert([{
          seller_id: user.id,
          title: title.trim(),
          description: description.trim(),
          make: make.trim(),
          model: model.trim(),
          year: parseInt(year),
          mileage: mileage ? parseInt(mileage) : null,
          vin: vin.trim().toUpperCase(),
          condition,
          body_type: bodyType || null,
          fuel_type: fuelType || null,
          transmission: transmission || null,
          color: color.trim() || null,
          price_coins: priceCoins ? parseInt(priceCoins) : null,
          price_usd: priceUsd ? parseFloat(priceUsd) : null,
          vin_verification_url: vinPdfUrl,
          images: PHOTO_CATEGORIES.map((photo) => photoUrls[photo.key]),
          photo_urls: photoUrls,
          problems: problems.trim(),
          diagnostic_codes: codes.trim(),
          check_engine_light: checkEngineLight,
          ceo_mechanic_verified: ceoMechanicVerified,
          ceo_mechanic_verification_statement: ceoMechanicVerified
            ? 'The Mai Troll CEO is a mechanic and will personally verify this vehicle listing.'
            : null,
          city: city.trim() || null,
          state: state.trim() || null,
          status: 'active',
        }])

      if (error) throw error

      toast.success('Vehicle listing created successfully!')
      resetForm()
      onListingCreated?.()
    } catch (err: any) {
      console.error('Vehicle listing error:', err)
      toast.error(err.message || 'Failed to create vehicle listing')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* VIN Verification - REQUIRED */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <FileText className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-400 text-base">VIN Verification Document *</h3>
            <p className="text-gray-300 text-sm mt-1">
              Upload your <strong>VINCheck® report PDF</strong> from the{' '}
              <a
                href="https://www.nicb.org/vincheck"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline hover:text-blue-300 inline-flex items-center gap-1"
              >
                National Insurance Crime Bureau (NICB)
                <ExternalLink className="w-3 h-3" />
              </a>
              . This is a <strong>mandatory requirement</strong> for all vehicle listings.
            </p>
          </div>
        </div>

        {vinPdfUrl ? (
          <div className="flex items-center gap-3 bg-green-900/20 border border-green-500/30 rounded-lg p-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-green-400 text-sm font-medium truncate">{vinPdfName}</p>
              <p className="text-green-400/70 text-xs">VIN verification uploaded successfully</p>
            </div>
            <a
              href={vinPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm underline"
            >
              View
            </a>
            <button
              type="button"
              onClick={removeVinPdf}
              className="p-1 text-red-400 hover:text-red-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div>
            <label
              htmlFor="vin-pdf-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-500/40 rounded-xl cursor-pointer hover:border-blue-400/60 hover:bg-blue-900/10 transition-colors"
            >
              {uploadingPdf ? (
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-blue-400 mb-2" />
                  <span className="text-sm text-blue-300 font-medium">Click to upload VINCheck® PDF</span>
                  <span className="text-xs text-gray-400 mt-1">PDF only, max 10MB</span>
                </>
              )}
            </label>
            <input
              id="vin-pdf-upload"
              type="file"
              accept="application/pdf"
              onChange={handleVinPdfUpload}
              className="hidden"
              disabled={uploadingPdf}
            />
          </div>
        )}

        <div className="mt-3 flex items-start gap-2 text-xs text-gray-400">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <span>
            Go to <a href="https://www.nicb.org/vincheck" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">nicb.org/vincheck</a>,
            enter your VIN, complete the lookup, and save/upload the resulting report as a PDF.
            Listings without a valid NICB VINCheck® report will be rejected.
          </span>
        </div>
      </div>

      {/* Required Vehicle Photos */}
      <div className="bg-slate-900/20 border border-slate-500/30 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <Upload className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-cyan-300 text-base">Required Vehicle Photos *</h3>
            <p className="text-gray-300 text-sm mt-1">
              Upload ten specific photos to document the vehicle condition. All categories are required.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PHOTO_CATEGORIES.map((photo) => (
            <div key={photo.key} className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">{photo.label}</label>
              <div className="flex items-center gap-2">
                <label
                  htmlFor={`photo-${photo.key}`}
                  className="flex-1 px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg text-sm text-gray-300 text-left cursor-pointer hover:border-cyan-400"
                >
                  {photoNames[photo.key] || `Upload ${photo.label}`}
                </label>
                <input
                  id={`photo-${photo.key}`}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload(photo.key, e)}
                  className="hidden"
                  disabled={photoUploading[photo.key]}
                />
                {photoUploading[photo.key] && <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />}
              </div>
              {photoUrls[photo.key] && (
                <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
                  <a href={photoUrls[photo.key]} target="_blank" rel="noreferrer" className="underline text-cyan-300">
                    View uploaded photo
                  </a>
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.key)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Problems, Codes, and Verification */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <Wrench className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-400 text-base">Inspection Summary *</h3>
            <p className="text-gray-300 text-sm mt-1">
              Provide the vehicle condition details and confirm the CEO mechanic verification.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Known problems *</label>
            <textarea
              value={problems}
              onChange={(e) => setProblems(e.target.value)}
              className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white resize-none h-24"
              placeholder="List all known problems, damage, or repairs needed..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Diagnostic trouble codes *</label>
            <textarea
              value={codes}
              onChange={(e) => setCodes(e.target.value)}
              className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white resize-none h-24"
              placeholder="Enter any active or stored engine codes, or state 'None' if there are no codes."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Check engine light</label>
              <div className="flex gap-3">
                <label className="inline-flex items-center gap-2 text-gray-300">
                  <input
                    type="radio"
                    name="check-engine-light"
                    checked={checkEngineLight === true}
                    onChange={() => setCheckEngineLight(true)}
                    className="text-purple-500"
                  />
                  Yes
                </label>
                <label className="inline-flex items-center gap-2 text-gray-300">
                  <input
                    type="radio"
                    name="check-engine-light"
                    checked={checkEngineLight === false}
                    onChange={() => setCheckEngineLight(false)}
                    className="text-purple-500"
                  />
                  No
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="inline-flex items-start gap-3 text-gray-300">
                <input
                  type="checkbox"
                  checked={ceoMechanicVerified}
                  onChange={(e) => setCeoMechanicVerified(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded bg-[#0D0D0D] border border-[#2C2C2C] text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm">
                  I confirm the Mai Troll CEO is a mechanic and will verify this vehicle listing.
                </span>
              </label>
              <p className="text-xs text-gray-500">
                This confirmation is required for all vehicle listings.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">Listing Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. 2023 Tesla Model 3 Long Range"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Make *</label>
          <input
            type="text"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. Toyota"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Model *</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. Camry"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Year *</label>
          <input
            type="number"
            min="1900"
            max={new Date().getFullYear() + 1}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. 2023"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Mileage</label>
          <input
            type="number"
            min="0"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. 45000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">VIN *</label>
          <input
            type="text"
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            maxLength={17}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white uppercase font-mono"
            placeholder="17-character VIN"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Must be exactly 17 characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Condition *</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
          >
            {VEHICLE_CONDITIONS.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Body Type</label>
          <select
            value={bodyType}
            onChange={(e) => setBodyType(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
          >
            <option value="">Select body type</option>
            {BODY_TYPES.map(b => (
              <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Fuel Type</label>
          <select
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
          >
            <option value="">Select fuel type</option>
            {FUEL_TYPES.map(f => (
              <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Transmission</label>
          <select
            value={transmission}
            onChange={(e) => setTransmission(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
          >
            <option value="">Select transmission</option>
            {TRANSMISSION_TYPES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Exterior Color</label>
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white"
            placeholder="e.g. Midnight Black"
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
            placeholder="e.g. 50000"
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
            placeholder="e.g. 25000.00"
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
          <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-500 focus:outline-none text-white resize-none h-28"
            placeholder="Describe the vehicle's features, history, modifications, etc."
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !vinPdfUrl}
        className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating Listing...
          </>
        ) : (
          <>
            <Car className="w-4 h-4" />
            Create Vehicle Listing
          </>
        )}
      </button>

      {!vinPdfUrl && (
        <p className="text-center text-sm text-yellow-400 flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          VIN verification PDF is required to create a listing
        </p>
      )}
    </form>
  )
}
