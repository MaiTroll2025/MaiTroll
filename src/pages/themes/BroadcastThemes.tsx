import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import ThemeCard from '../../components/themes/ThemeCard';
import ThemeCategoryTabs from '../../components/themes/ThemeCategoryTabs';
import type { BroadcastTheme } from '../../components/themes/SoloBroadcastMockup';
import CEOTheme from '../themes/CEOTheme';

// Import the premium CSS — this is the file that drives all border glows,
// slot frames, and overlay radiance. Without this import nothing renders.
import '../../styles/broadcast-themes.css';

const THEMES: BroadcastTheme[] = [
  { id: 'cash-1',   name: 'Cashfall Storm',         category: 'cash',   accentColor: '#22c55e', backgroundImage: '', isPremium: false },
  { id: 'cash-2',   name: 'Money Rain Vault',        category: 'cash',   accentColor: '#eab308', backgroundImage: '', isPremium: false },
  { id: 'smoke-1',  name: 'Smoker Cloud Drift',      category: 'smoke',  accentColor: '#a855f7', backgroundImage: '', isPremium: false },
  { id: 'smoke-2',  name: 'Blue Haze Roll',          category: 'smoke',  accentColor: '#22d3ee', backgroundImage: '', isPremium: false },
  { id: 'drinks-1', name: 'Neon Bar Pour',           category: 'drinks', accentColor: '#f59e0b', backgroundImage: '', isPremium: false },
  { id: 'drinks-2', name: 'Pink Champagne Lounge',   category: 'drinks', accentColor: '#ec4899', backgroundImage: '', isPremium: false },
  { id: 'girly-1',  name: 'Crystal Rose Shine',      category: 'girly',  accentColor: '#f472b6', backgroundImage: '', isPremium: false },
  { id: 'girly-2',  name: 'Butterfly Glitter Sky',   category: 'girly',  accentColor: '#e879f9', backgroundImage: '', isPremium: false },
  { id: 'pride-1',  name: 'Rainbow Flag Motion',     category: 'pride',  accentColor: '#8b5cf6', backgroundImage: '', isPremium: false },
  { id: 'pride-2',  name: 'Pride Wave Lights',       category: 'pride',  accentColor: '#34d399', backgroundImage: '', isPremium: false },
  { id: 'car-1',    name: 'Parts and Pistons',       category: 'car',    accentColor: '#3b82f6', backgroundImage: '', isPremium: false },
  { id: 'car-2',    name: 'Street Roll Motion',      category: 'car',    accentColor: '#f97316', backgroundImage: '', isPremium: false },
  { id: 'music-1',  name: 'Mic Drop Reactor',        category: 'music',  accentColor: '#8b5cf6', backgroundImage: '', isPremium: false },
  { id: 'music-2',  name: 'Note Wave Studio',        category: 'music',  accentColor: '#06b6d4', backgroundImage: '', isPremium: false },
];

export default function BroadcastThemes() {
  const [activeCategory, setActiveCategory] = useState('cash');
  const [mode, setMode] = useState<'solo' | 'battle'>('solo');
  const [selectedTheme, setSelectedTheme] = useState<string>('cash-1');

  const categories = ['cash', 'smoke', 'drinks', 'girly', 'pride', 'car', 'music', 'ceo'];
  const list = useMemo(() => THEMES.filter((t) => t.category === activeCategory), [activeCategory]);

  if (activeCategory === 'ceo') {
    return <CEOTheme onBack={() => setActiveCategory('cash')} mode={mode} setMode={setMode} />;
  }

  return (
    <div className="min-h-screen bg-black px-4 py-4 text-white font-inter">
      <div className="sticky top-0 z-30 mb-3 border-b border-white/10 bg-black/90 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <motion.h1
            key={activeCategory}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-lg font-bold"
          >
            Mai Troll Broadcast Themes
          </motion.h1>
          <div className="flex gap-2">
            <button
              onClick={() => setMode('solo')}
              className={`rounded-md px-3 py-1 text-xs ${mode === 'solo' ? 'bg-white/20' : 'bg-white/5'}`}
            >
              Solo
            </button>
            <button
              onClick={() => setMode('battle')}
              className={`rounded-md px-3 py-1 text-xs ${mode === 'battle' ? 'bg-white/20' : 'bg-white/5'}`}
            >
              Battle
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-3">
        <ThemeCategoryTabs categories={categories} active={activeCategory} onChange={setActiveCategory} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((theme, i) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              mode={mode}
              index={i}
              selected={selectedTheme === theme.id}
              onSelect={() => setSelectedTheme(theme.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}