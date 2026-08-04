import React from 'react'
import { MessageSquare } from 'lucide-react'

export default function Mai TrollWall() {
  return (
    <div className="h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex flex-col pt-24 px-6 pb-6">
      <div className="max-w-3xl mx-auto w-full h-full flex flex-col space-y-6">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-purple-400" />
              Mai Troll Wall
            </h1>
            <p className="text-gray-400 mt-1">Share updates, achievements, and connect with the community</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center text-gray-400">
          <p>Wall posts are currently unavailable.</p>
        </div>
      </div>
    </div>
  )
}