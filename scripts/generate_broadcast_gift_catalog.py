from pathlib import Path
import textwrap

root = Path(r'c:\Users\kainm\TC ONLY\TrollCity')
assets_dir = root / 'public' / 'gifts'
assets_dir.mkdir(parents=True, exist_ok=True)

asset_specs = [
    ('coin-burst', 'Coin Burst', '#fbbf24', '#f59e0b', 'circle'),
    ('diamond-crest', 'Diamond Crest', '#38bdf8', '#818cf8', 'diamond'),
    ('luxury-yacht', 'Luxury Yacht', '#c084fc', '#7c3aed', 'boat'),
    ('private-jet', 'Private Jet', '#60a5fa', '#1d4ed8', 'plane'),
    ('mansion-glow', 'Mansion Glow', '#fb923c', '#b45309', 'house'),
    ('sports-car', 'Sports Car', '#f87171', '#dc2626', 'car'),
    ('gold-bar', 'Gold Bar', '#fde68a', '#d97706', 'bar'),
    ('neon-halo', 'Neon Halo', '#34d399', '#047857', 'halo'),
    ('rocketflare', 'Rocketflare', '#a7f3d0', '#059669', 'rocket'),
    ('trophy-shine', 'Trophy Shine', '#fde047', '#ca8a04', 'trophy'),
    ('starlight', 'Starlight', '#e0e7ff', '#4338ca', 'star'),
    ('aurora', 'Aurora', '#f5d0fe', '#db2777', 'swirl'),
]

for slug, name, color1, color2, shape in asset_specs:
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{color1}" />
      <stop offset="100%" stop-color="{color2}" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="64" fill="#080b16"/>
  <circle cx="256" cy="256" r="180" fill="url(#g)" opacity="0.18"/>
  <path d="M96 256c0-90 70-160 160-160s160 70 160 160-70 160-160 160S96 346 96 256Z" fill="none" stroke="url(#g)" stroke-width="24"/>
  <g fill="white" opacity="0.92">
    <circle cx="256" cy="256" r="38"/>
    <circle cx="256" cy="256" r="110" fill="none" stroke="white" stroke-width="18" stroke-dasharray="12 14"/>
  </g>
  <text x="256" y="440" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="white" text-anchor="middle">{name}</text>
</svg>'''
    (assets_dir / f'{slug}.svg').write_text(svg, encoding='utf-8')

values = [
    10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100, 120, 150, 180, 200, 250, 300, 400, 500, 600,
    750, 900, 1000, 1250, 1500, 1800, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 8000, 10000,
    12000, 15000, 18000, 20000, 25000, 30000, 40000, 50000, 60000, 75000, 100000, 125000,
    150000, 200000, 250000, 300000, 400000, 500000, 600000, 750000, 1000000, 1500000, 2500000,
    5000000, 10000000, 25000000, 50000000, 100000000, 250000000, 500000000, 1000000000,
]
if len(values) != 60:
    raise SystemExit(f'Expected 60 values, got {len(values)}')

base_names = [
    'Glow Coin', 'Solar Spark', 'Crown Pulse', 'Royal Halo', 'Diamond Rain', 'Luxe Ember', 'Skyline Beam',
    'Golden Echo', 'Neon Prism', 'Velvet Vault', 'Midas Rush', 'Apex Aura', 'Galaxy Thread', 'Platinum Pulse',
    'Mirror Crest', 'Starfall Crown', 'Empire Crest', 'Infinity Ring', 'Titan Vault', 'Moonlight Key', 'Nova Bloom',
    'Silver Strike', 'Golden Orbit', 'Royal Ledger', 'Treasure Pulse', 'Elite Charge', 'Luxury Burst', 'Diamond Pulse',
    'Jetstream', 'Skyline Crown', 'Empire Halo', 'Crystal Beam', 'Crown Jewel', 'Mansion Glow', 'Studio Halo',
    'Champagne Arc', 'Treasure Lattice', 'Apex Prism', 'Golden Lift', 'Moonlit Halo', 'Rocket Bloom', 'Midas Wave',
    'Diamond Bloom', 'Crown Arc', 'Echo Vault', 'Royal Prism', 'Celestial Ledger', 'Platinum Arc', 'Starlight Crown',
    'Aurora Vault', 'Nebula Crest', 'Titan Crown', 'Royal Burst', 'Golden Gate', 'Luxe Beacon', 'Diamond Halo',
    'Infinity Crown', 'Galaxy Vault', 'Royal Stream', 'Midas Crown', 'Aurora Crest'
]
if len(base_names) != 60:
    raise SystemExit(f'Expected 60 names, got {len(base_names)}')

categories = [
    'General', 'General', 'Royalty', 'Royalty', 'Luxury', 'Luxury', 'Luxury', 'Luxury', 'Luxury', 'Luxury',
    'General', 'General', 'General', 'General', 'General', 'General', 'General', 'Luxury', 'Luxury', 'Luxury',
    'Royalty', 'Royalty', 'Royalty', 'Royalty', 'Royalty', 'Royalty', 'Royalty', 'Luxury', 'Luxury', 'Luxury',
    'Luxury', 'Luxury', 'Luxury', 'Luxury', 'Luxury', 'Luxury', 'Luxury', 'Luxury', 'Luxury', 'Luxury',
    'Luxury', 'Luxury', 'Luxury', 'Luxury', 'Luxury', 'Luxury', 'Luxury', 'Luxury', 'Luxury', 'Luxury',
    'Royalty', 'Royalty', 'Royalty', 'Royalty', 'Royalty', 'Royalty', 'Royalty', 'Royalty', 'Royalty', 'Royalty',
]
if len(categories) != 60:
    raise SystemExit(f'Expected 60 categories, got {len(categories)}')

asset_pool = [asset_specs[i % len(asset_specs)][0] for i in range(60)]

rows = []
for idx, (value, name, category, asset) in enumerate(zip(values, base_names, categories, asset_pool), start=1):
    slug = f'gift_{name.lower().replace(" ", "-").replace("'", "")}-{idx:02d}'
    icon = '💎' if idx % 3 == 0 else '✨' if idx % 2 == 0 else '💰'
    rows.append((slug, name, value, icon, category, asset))

sql_lines = []
sql_lines.append('-- Broadcast gift catalog expansion for viewer and broadcast pages')
sql_lines.append('ALTER TABLE public.user_profiles ALTER COLUMN troll_coins TYPE BIGINT USING COALESCE(troll_coins, 0)::BIGINT;')
sql_lines.append('')
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS name TEXT;")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS icon TEXT;")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS value BIGINT;")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS gift_slug TEXT;")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS category TEXT;")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'troll_coins';")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS description TEXT;")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS animation_type TEXT DEFAULT 'emoji';")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS animation_key TEXT;")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT 'common';")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS animation_url TEXT;")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS animation_duration_ms INTEGER DEFAULT 4500;")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS sound_url TEXT;")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS is_fullscreen BOOLEAN DEFAULT false;")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS tray_visual_url TEXT;")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS tray_gradient TEXT;")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;")
sql_lines.append("ALTER TABLE public.gift_items ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 12;")
sql_lines.append('')
sql_lines.append("DO $$")
sql_lines.append('BEGIN')
sql_lines.append("  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_gift_items_gift_slug_unique') THEN")
sql_lines.append("    CREATE UNIQUE INDEX idx_gift_items_gift_slug_unique ON public.gift_items (gift_slug) WHERE gift_slug IS NOT NULL;")
sql_lines.append('  END IF;')
sql_lines.append('END $$;')
sql_lines.append('')
sql_lines.append("INSERT INTO public.gift_items (gift_slug, name, value, icon, category, currency, description, animation_type, rarity, status, is_active, animation_url, tray_visual_url, tray_gradient)")
sql_lines.append('VALUES')

for idx, (slug, name, value, icon, category, asset) in enumerate(rows):
    suffix = ',' if idx < len(rows)-1 else ''
    gradient = 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' if idx % 3 == 0 else 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)' if idx % 3 == 1 else 'linear-gradient(135deg, #c084fc 0%, #7c3aed 100%)'
    sql_lines.append(f"  ('{slug}', '{name.replace("'", "''")}', {value}, '{icon}', '{category}', 'troll_coins', '{name} for premium broadcast support.', 'emoji', 'common', 'active', true, '/gifts/{asset}.svg', '/gifts/{asset}.svg', '{gradient}')" + suffix)

sql_lines.append("ON CONFLICT (gift_slug) DO UPDATE SET")
sql_lines.append("  name = EXCLUDED.name,")
sql_lines.append("  value = EXCLUDED.value,")
sql_lines.append("  icon = EXCLUDED.icon,")
sql_lines.append("  category = EXCLUDED.category,")
sql_lines.append("  currency = EXCLUDED.currency,")
sql_lines.append("  description = EXCLUDED.description,")
sql_lines.append("  animation_type = EXCLUDED.animation_type,")
sql_lines.append("  rarity = EXCLUDED.rarity,")
sql_lines.append("  status = EXCLUDED.status,")
sql_lines.append("  is_active = EXCLUDED.is_active,")
sql_lines.append("  animation_url = EXCLUDED.animation_url,")
sql_lines.append("  tray_visual_url = EXCLUDED.tray_visual_url,")
sql_lines.append("  tray_gradient = EXCLUDED.tray_gradient;")
sql_lines.append('')
sql_lines.append("DO $$")
sql_lines.append('BEGIN')
sql_lines.append("  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchasable_items') THEN")
sql_lines.append("    INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_active, metadata)")
sql_lines.append('    VALUES')
for idx, (slug, name, value, icon, category, asset) in enumerate(rows):
    suffix = ',' if idx < len(rows)-1 else ''
    sql_lines.append(f"      ('{slug}', '{name.replace("'", "''")}', 'gift', {value}, true, '{{"icon": "{icon}", "subcategory": "{category}", "animation_url": "/gifts/{asset}.svg"}}')" + suffix)
sql_lines.append("    ON CONFLICT (item_key) DO UPDATE SET")
sql_lines.append("      display_name = EXCLUDED.display_name,")
sql_lines.append("      coin_price = EXCLUDED.coin_price,")
sql_lines.append("      is_active = EXCLUDED.is_active,")
sql_lines.append("      metadata = EXCLUDED.metadata;")
sql_lines.append("  END IF;")
sql_lines.append('END $$;')

migration_path = root / 'supabase' / 'migrations' / '20290815000013_broadcast_gift_catalog_and_wallet_limits.sql'
migration_path.write_text('\n'.join(sql_lines) + '\n', encoding='utf-8')
print(migration_path)
