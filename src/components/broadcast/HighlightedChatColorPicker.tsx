// src/components/broadcast/HighlightedChatColorPicker.tsx
// Color picker for MaiTroll Highlighted Chat perk

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette } from 'lucide-react';

const PRESET_COLORS = [
  '#ff006e', '#fb5607', '#ffbe0b', '#8338ec',
  '#3a86ff', '#06ffa5', '#ff006e', '#ff4d6d',
  '#c9184a', '#ff758f', '#00f5d4', '#00bbf9',
  '#9b5de5', '#f15bb5', '#fee440', '#00bb27',
];

interface HighlightedChatColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  onPurchase?: () => void;
  canPurchase?: boolean;
}

export default function HighlightedChatColorPicker({
  selectedColor,
  onColorChange,
  onPurchase,
  canPurchase = false,
}: HighlightedChatColorPickerProps) {
  const [customColor, setCustomColor] = useState(selectedColor);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4 text-neon-blue" />
        <span className="text-sm font-medium text-zinc-300">Highlight Color</span>
      </div>

      <div className="grid grid-cols-8 gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => {
              onColorChange(color);
              setCustomColor(color);
            }}
            className={`w-8 h-8 rounded-lg border-2 transition-all ${
              selectedColor === color
                ? 'border-white scale-110 shadow-lg'
                : 'border-white/20 hover:border-white/40'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={customColor}
          onChange={(e) => {
            setCustomColor(e.target.value);
            onColorChange(e.target.value);
          }}
          className="w-10 h-10 rounded-lg border-2 border-white/20 bg-transparent cursor-pointer"
        />
        <span className="text-xs text-zinc-400 font-mono">{customColor}</span>
      </div>

      {canPurchase && onPurchase && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onPurchase}
          className="w-full py-2 bg-gradient-to-r from-neon-blue to-neon-purple rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
        >
          Purchase Highlighted Chat (50 Troll Coins)
        </motion.button>
      )}
    </div>
  );
}
