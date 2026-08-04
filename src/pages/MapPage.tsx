import React from 'react'
import { MapPin, Home, Users, Shield, Zap } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'

export default function MapPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0d1222] to-[#1c1334] text-white py-6 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-600/20 px-4 py-2 text-sm font-semibold text-violet-200">
            <MapPin className="w-4 h-4 text-violet-300" />
            Neighborhood Map
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Mai Troll Streets</h1>
          <p className="max-w-2xl mx-auto text-slate-400">
            Explore your neighborhood, manage your properties, and connect with family members across the city blocks.
          </p>
        </div>

        {/* Map Placeholder */}
        <Card className="overflow-hidden border-slate-700 bg-slate-900/80 shadow-2xl shadow-black/20">
          <CardHeader className="bg-slate-950/90 border-b border-slate-700 px-6 py-5">
            <CardTitle className="text-xl text-white flex items-center gap-3">
              <MapPin className="w-5 h-5 text-cyan-400" />
              City Map View
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-700 flex items-center justify-center">
              <div className="text-center space-y-4">
                <MapPin className="w-16 h-16 text-slate-500 mx-auto" />
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-slate-300">Interactive Map Coming Soon</h3>
                  <p className="text-slate-500 max-w-md">
                    This will be your gamified neighborhood map where you can explore streets,
                    manage properties, and see family member locations.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-700 bg-slate-900/80">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Home className="w-6 h-6 text-cyan-400" />
                <h3 className="font-semibold text-white">My Properties</h3>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Manage your house, upgrades, and utilities.
              </p>
              <Button variant="outline" className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-900/80">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-green-400" />
                <h3 className="font-semibold text-white">Family Members</h3>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Invite and manage your neighborhood family.
              </p>
              <Button variant="outline" className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-900/80">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-yellow-400" />
                <h3 className="font-semibold text-white">Officer Patrols</h3>
              </div>
              <p className="text-slate-400 text-sm mb-4">
                Monitor your ZIP code's safety and crime levels.
              </p>
              <Button variant="outline" className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Map Features Preview */}
        <Card className="border-slate-700 bg-slate-900/80">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-3">
              <Zap className="w-5 h-5 text-purple-400" />
              Map Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <h4 className="font-semibold text-white">Street Exploration</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li>• Navigate between city blocks</li>
                  <li>• View property ownership and status</li>
                  <li>• See family member locations</li>
                  <li>• Discover nearby events and activities</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-white">Neighborhood Management</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li>• Manage house upgrades and utilities</li>
                  <li>• Invite new family members</li>
                  <li>• Monitor ZIP code safety ratings</li>
                  <li>• Participate in neighborhood raids</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}