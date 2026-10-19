import React from 'react';
import { motion } from 'framer-motion';

const categoryIcons: Record<string, string> = {
  cash: '$',
  smoke: '~',
  drinks: 'D',
  girly: '*',
  car: 'C',
  music: 'M',
  ceo: 'G',
};

export default function ThemeCategoryTabs({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="sticky top-14 z-20 overflow-x-auto rounded-xl border border-white/10 bg-black/70 p-2 backdrop-blur">
      <div className="flex min-w-max gap-2">
        {categories.map((cat) => {
          const isActive = cat === active;
          return (
            <button key={cat} onClick={() => onChange(cat)} className="relative rounded-lg px-3 py-1.5 text-xs text-white">
              <span className="mr-1">{categoryIcons[cat] || '?'}</span>
              {cat.toUpperCase()}
              {isActive && <motion.div layoutId="activeTab" className="absolute inset-0 -z-10 rounded-lg bg-white/15" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
