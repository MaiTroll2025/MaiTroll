import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, Zap, Droplets, Wifi, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface HouseFeesModalProps {
  isOpen: boolean
  onClose: () => void
  house: any
  onFeesPaid?: () => void
}

const DEFAULT_FEES = {
  deed: 500,
  electric: 100,
  water: 75,
  internet: 50,
  yard_trash: 25,
  total: 250
}

export default function HouseFeesModal({ isOpen, onClose, house, onFeesPaid }: HouseFeesModalProps) {
  const _navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [paying, setPaying] = useState(false)
  const [selectedFees, setSelectedFees] = useState({
    deed: false,
    electric: false,
    water: false,
    internet: false,
    yard_trash: false
  })

  const fees = DEFAULT_FEES

  const handlePay = async () => {
    if (!user?.id || !house) return

    const totalDue = (
      (selectedFees.electric ? fees.electric : 0) +
      (selectedFees.water ? fees.water : 0) +
      (selectedFees.internet ? fees.internet : 0) +
      (selectedFees.yard_trash ? fees.yard_trash : 0) +
      (selectedFees.deed ? fees.deed : 0)
    )

    if (totalDue === 0) {
      toast.error('Select at least one fee to pay')
      return
    }

    // Check if user has enough coins
    if ((profile?.troll_coins || 0) < totalDue) {
      toast.error('Not enough Troll Coins')
      return
    }

    setPaying(true)
    try {
      // Deduct coins
      await supabase.rpc('deduct_coins', { amount: totalDue })

      // Update house utilities
      const updates: any = {}
      if (selectedFees.electric) updates.electric_on = true
      if (selectedFees.water) updates.water_on = true
      if (selectedFees.internet) updates.internet_on = true

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('houses')
          .update(updates)
          .eq('id', house.id)
      }

      toast.success('Utilities connected!')
      onFeesPaid?.()
      onClose()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setPaying(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="bg-slate-800 border-slate-700 max-w-md w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Home className="w-5 h-5 text-blue-400" />
            House Utilities
          </CardTitle>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-400 text-sm">
            Credit Score: {profile?.credit_score || 400} (Requirement: 400)
          </p>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedFees.deed}
                  onChange={() => setSelectedFees(s => ({ ...s, deed: !s.deed }))}
                  className="w-5 h-5"
                />
                <div>
                  <p className="text-white font-medium">Deed Fee (One-time)</p>
                  <p className="text-gray-400 text-xs">Transfer ownership to you</p>
                </div>
              </div>
              <span className="text-yellow-400 font-bold">{fees.deed} TC</span>
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedFees.electric}
                  onChange={() => setSelectedFees(s => ({ ...s, electric: !s.electric }))}
                  className="w-5 h-5"
                />
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <p className="text-white font-medium">Electric</p>
                </div>
              </div>
              <span className="text-yellow-400 font-bold">{fees.electric} TC</span>
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedFees.water}
                  onChange={() => setSelectedFees(s => ({ ...s, water: !s.water }))}
                  className="w-5 h-5"
                />
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-400" />
                  <p className="text-white font-medium">Water</p>
                </div>
              </div>
              <span className="text-yellow-400 font-bold">{fees.water} TC</span>
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedFees.internet}
                  onChange={() => setSelectedFees(s => ({ ...s, internet: !s.internet }))}
                  className="w-5 h-5"
                />
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-green-400" />
                  <p className="text-white font-medium">Internet</p>
                </div>
              </div>
              <span className="text-yellow-400 font-bold">{fees.internet} TC</span>
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedFees.yard_trash}
                  onChange={() => setSelectedFees(s => ({ ...s, yard_trash: !s.yard_trash }))}
                  className="w-5 h-5"
                />
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-gray-400" />
                  <p className="text-white font-medium">Yard & Trash</p>
                </div>
              </div>
              <span className="text-yellow-400 font-bold">{fees.yard_trash} TC</span>
            </label>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-700">
            <span className="text-white font-bold">Total Due</span>
            <span className="text-yellow-400 font-bold">
              {(
                (selectedFees.electric ? fees.electric : 0) +
                (selectedFees.water ? fees.water : 0) +
                (selectedFees.internet ? fees.internet : 0) +
                (selectedFees.yard_trash ? fees.yard_trash : 0) +
                (selectedFees.deed ? fees.deed : 0)
              )} TC
            </span>
          </div>

          <Button
            onClick={handlePay}
            disabled={paying}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500"
          >
            {paying ? 'Processing...' : 'Pay Now'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}