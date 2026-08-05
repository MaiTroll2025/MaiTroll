import React from 'react'

interface MaiTrollSpinnerProps {
  text?: string
  subtext?: string
}

export const MaiTrollSpinner: React.FC<MaiTrollSpinnerProps> = ({ 
  text = "Loading Mai Troll...", 
  subtext 
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="relative w-16 h-16 mb-4">
        {/* Background ring */}
        <div className="absolute inset-0 rounded-full border-4 border-purple-500/20"></div>
        
        {/* Spinning gradient ring */}
        <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 border-r-pink-500 border-b-transparent border-l-transparent animate-spin"></div>
        
        {/* Inner glowing dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-purple-400 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.8)] animate-pulse"></div>
        </div>
      </div>
      
      <div className="text-center space-y-2">
        <div className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 animate-pulse">
          {text}
        </div>
        {subtext && (
          <div className="text-sm text-gray-400">
            {subtext}
          </div>
        )}
      </div>
    </div>
  )
}
