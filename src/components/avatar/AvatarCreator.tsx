import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { Save, Palette, Shirt, Crown, Sparkles } from 'lucide-react'
import { Button } from '../ui/button'

interface AvatarPreviewProps {
  avatarUrl: string | null
}

interface AvatarCreatorProps {
  onComplete?: () => void
  compact?: boolean
}

const TROLL_AVATAR_STYLES = [
  { id: 'classic', name: 'Classic Troll', color: '#8B4513' },
  { id: 'blue', name: 'Ice Troll', color: '#00BFFF' },
  { id: 'green', name: 'Forest Troll', color: '#228B22' },
  { id: 'purple', name: 'Shadow Troll', color: '#800080' },
  { id: 'red', name: 'Magma Troll', color: '#FF4500' },
  { id: 'gold', name: 'Royal Troll', color: '#FFD700' }
]

const HAIRSTYLES = [
  { id: 'bald', name: 'Bald' },
  { id: 'short', name: 'Short' },
  { id: 'spiky', name: 'Spiky' },
  { id: 'dreadlocks', name: 'Dreadlocks' },
  { id: 'mohawk', name: 'Mohawk' },
  { id: 'long', name: 'Flowing' }
]

const OUTFITS = [
  { id: 'casual', name: 'Casual Hoodie', price: 0 },
  { id: 'street', name: 'Street Style', price: 500 },
  { id: 'formal', name: 'Troll Tuxedo', price: 1000 },
  { id: 'armor', name: 'Battle Armor', price: 2000 },
  { id: 'royal', name: 'Royal Garments', price: 5000 },
  { id: 'legendary', name: 'Legendary Robes', price: 10000 }
]

const ACCESSORIES = [
  { id: 'none', name: 'None', price: 0 },
  { id: 'horns', name: 'Golden Horns', price: 500 },
  { id: 'crown', name: 'Tiny Crown', price: 1000 },
  { id: 'chains', name: 'Chain Necklace', price: 750 },
  { id: 'rings', name: 'Ring Set', price: 500 },
  { id: 'glasses', name: 'Cool Shades', price: 300 }
]

export default function AvatarCreator({ onComplete, compact = false }: AvatarCreatorProps) {
  const { user, profile } = useAuthStore()
  const [selectedStyle, setSelectedStyle] = useState(TROLL_AVATAR_STYLES[0])
  const [selectedHair, setSelectedHair] = useState(HAIRSTYLES[0])
  const [selectedOutfit, setSelectedOutfit] = useState(OUTFITS[0])
  const [selectedAccessory, setSelectedAccessory] = useState(ACCESSORIES[0])
  const [saving, setSaving] = useState(false)

  const generateAvatarUrl = () => {
    // Generate a simple SVG-based avatar URL
    // In production, this would generate a real image
    const params = new URLSearchParams({
      style: selectedStyle.id,
      hair: selectedHair.id,
      outfit: selectedOutfit.id,
      accessory: selectedAccessory.id
    })
    return `https://Mai Troll.app/avatar/${user?.id}/troll.svg?${params.toString()}`
  }

  const handleSave = async () => {
    if (!user?.id) return

    setSaving(true)
    try {
      const avatarUrl = generateAvatarUrl()

      const { error } = await supabase
        .from('user_profiles')
        .update({
          troll_avatar_url: avatarUrl
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success('Troll avatar created!')
      onComplete?.()
    } catch (error: any) {
      console.error('Error saving avatar:', error)
      toast.error('Failed to save avatar')
    } finally {
      setSaving(false)
    }
  }

  const AvatarPreview = () => (
    <div className="relative w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center overflow-hidden border-4" style={{ borderColor: selectedStyle.color }}>
      <div className="absolute inset-0 flex items-center justify-center">
        {selectedAccessory.id === 'crown' && (
          <Crown className="w-8 h-8 absolute -top-2 text-yellow-400" />
        )}
        {selectedAccessory.id === 'horns' && (
          <div className="absolute -top-1 flex gap-4">
            <div className="w-3 h-6 rotate-[-30deg] rounded-t-full" style={{ background: selectedStyle.color }} />
            <div className="w-3 h-6 rotate-[30deg] rounded-t-full" style={{ background: selectedStyle.color }} />
          </div>
        )}
        <div className="w-16 h-16 rounded-full" style={{ background: selectedStyle.color, opacity: 0.8 }}>
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">👹</span>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 bg-black/50 px-2 py-1 rounded-full text-xs text-white">
        {selectedOutfit.name}
      </div>
    </div>
  )

  if (compact) {
    return (
      <div className="p-4">
        <div className="mb-4">
          <AvatarPreview />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-gray-400">Style: {selectedStyle.name}</p>
          <p className="text-sm text-gray-400">Outfit: {selectedOutfit.name}</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
          {saving ? 'Saving...' : 'Save Avatar'}
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Create Your Troll Avatar</h2>
        <p className="text-gray-400">Customize your troll character for broadcast</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Style Selection */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
              <Palette className="w-4 h-4" /> Troll Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TROLL_AVATAR_STYLES.map(style => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedStyle.id === style.id
                      ? 'border-white bg-white/10'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full mx-auto mb-1" style={{ background: style.color }} />
                  <span className="text-xs text-gray-300">{style.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hair Style */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
              <Sparkles className="w-4 h-4" /> Hair Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {HAIRSTYLES.map(hair => (
                <button
                  key={hair.id}
                  onClick={() => setSelectedHair(hair)}
                  className={`p-2 rounded-lg border-2 transition-all text-xs ${
                    selectedHair.id === hair.id
                      ? 'border-white bg-white/10'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {hair.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Preview */}
          <div className="text-center">
            <AvatarPreview />
          </div>

          {/* Outfit Selection */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
              <Shirt className="w-4 h-4" /> Outfit
            </label>
            <div className="grid grid-cols-2 gap-2">
              {OUTFITS.map(outfit => (
                <button
                  key={outfit.id}
                  onClick={() => setSelectedOutfit(outfit)}
                  className={`p-2 rounded-lg border-2 transition-all text-xs ${
                    selectedOutfit.id === outfit.id
                      ? 'border-white bg-white/10'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {outfit.name}
                  {outfit.price > 0 && <span className="text-yellow-400 ml-1">({outfit.price})</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Accessories */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
              <Crown className="w-4 h-4" /> Accessories
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ACCESSORIES.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccessory(acc)}
                  className={`p-2 rounded-lg border-2 transition-all text-xs ${
                    selectedAccessory.id === acc.id
                      ? 'border-white bg-white/10'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {acc.name}
                  {acc.price > 0 && <span className="text-yellow-400 ml-1">({acc.price})</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
        >
          <Save className="w-5 h-5 mr-2" />
          {saving ? 'Saving...' : 'Save Troll Avatar'}
        </Button>
      </div>
    </div>
  )
}