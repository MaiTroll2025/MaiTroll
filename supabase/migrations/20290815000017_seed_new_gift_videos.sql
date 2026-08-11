-- Remove old emoji-based catalog gifts and replace with the new video-backed catalog
UPDATE public.gift_items
SET
  animation_url = NULL,
  animation_type = 'emoji',
  is_active = false,
  status = 'inactive'
WHERE gift_slug LIKE 'gift_%';

-- Replace the gift video asset URLs for the existing catalog rows with the
-- current public gift-videos storage path. This keeps the existing coin_cost
-- values intact and points each gift to the matching public video asset.
DO $$
DECLARE
  base_url text := 'https://gejtbllazzighxwxudyu.supabase.co';
  storage_prefix text := '/storage/v1/object/public/gift-videos/';
BEGIN
  UPDATE public.gift_items
  SET
    animation_url = base_url || storage_prefix || regexp_replace(gift_slug, '^gift[_-]+', '', 'i') || '.webm',
    animation_type = 'video',
    is_active = true
  WHERE gift_slug IN (
    'party-popper','thumbs-up','troll-laugh','eyeball','jail-bars','pie-to-face',
    'screaming-ghost','angry-goose','dancing-banana','clown-horn','chicken',
    'egg-toss','tomato','ocean','bank-heist','zoo-rap','mai-rap','im-him',
    'take-over','universe-2-0','mai-paparazzi-queen','firefly-gold-coin','four20',
    'ceo','10-coins','shots','toilet-paper','click-me','mai-troll-planet'
  );
END $$;

-- Seed new gift catalog items matching uploaded video assets
INSERT INTO public.gift_items (
  gift_slug, name, icon, coin_cost, category, description,
  animation_url, animation_type, animation_key, rarity,
  is_fullscreen, animation_duration_ms, sound_url, is_active, status
)
SELECT
  gift_slug,
  name,
  icon,
  coin_cost,
  category,
  description,
  animation_url,
  animation_type,
  animation_key,
  rarity,
  is_fullscreen,
  animation_duration_ms,
  sound_url,
  is_active,
  status
FROM (
  VALUES
    ('party-popper', 'Party Popper', '🎉', 100, 'celebration', 'Party popper celebration animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/party-popper.webm', 'video', 'party_popper', 'common', false, 3000, NULL, true, 'active'),
    ('thumbs-up', 'Thumbs Up', '👍', 50, 'reaction', 'Thumbs up reaction animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/thumbs-up.webm', 'video', 'thumbs_up', 'common', false, 2500, NULL, true, 'active'),
    ('troll-laugh', 'Troll Laugh', '😂', 200, 'reaction', 'Troll laugh animation with sound', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/troll-laugh.webm', 'video', 'troll_laugh', 'rare', false, 4000, 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/sounds/evil_laugh.mp3', true, 'active'),
    ('eyeball', 'Eyeball', '👁', 150, 'scary', 'Eyeball scare animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/eyeball.webm', 'video', 'eyeball', 'uncommon', false, 3500, NULL, true, 'active'),
    ('jail-bars', 'Jail Bars', '⛓', 300, 'punishment', 'Jail bars confinement animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/jail-bars.webm', 'video', 'jail_bars', 'epic', false, 5000, NULL, true, 'active'),
    ('pie-to-face', 'Pie to Face', '🥧', 250, 'fun', 'Pie to face slap animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/pie-to-face.webm', 'video', 'pie_to_face', 'uncommon', false, 3000, NULL, true, 'active'),
    ('screaming-ghost', 'Screaming Ghost', '👻', 175, 'scary', 'Screaming ghost animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/screaming-ghost.webm', 'video', 'screaming_ghost', 'rare', false, 4000, NULL, true, 'active'),
    ('angry-goose', 'Angry Goose', '🪿', 200, 'reaction', 'Angry goose chase animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/angry-goose.webm', 'video', 'angry_goose', 'rare', false, 3500, NULL, true, 'active'),
    ('dancing-banana', 'Dancing Banana', '🍌', 100, 'fun', 'Dancing banana animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/dancing-banana.webm', 'video', 'dancing_banana', 'common', false, 3000, NULL, true, 'active'),
    ('clown-horn', 'Clown Horn', '🎺', 125, 'fun', 'Clown horn honk animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/clown-horn.webm', 'video', 'clown_horn', 'common', false, 2000, NULL, true, 'active'),
    ('chicken', 'Chicken', '🐔', 75, 'animal', 'Chicken dance animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/chicken.webm', 'video', 'chicken', 'common', false, 2500, NULL, true, 'active'),
    ('egg-toss', 'Egg Toss', '🥚', 90, 'fun', 'Egg toss animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/egg-toss.webm', 'video', 'egg_toss', 'common', false, 2500, NULL, true, 'active'),
    ('tomato', 'Tomato', '🍅', 60, 'food', 'Tomato throw animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/tomato.webm', 'video', 'tomato', 'common', false, 2000, NULL, true, 'active'),
    ('ocean', 'Ocean', '🌊', 150, 'nature', 'Ocean wave animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/ocean.webm', 'video', 'ocean', 'uncommon', false, 4000, NULL, true, 'active'),
    ('bank-heist', 'Bank Heist', '🏦', 500, 'action', 'Bank heist animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/bank-heist.webm', 'video', 'bank_heist', 'epic', false, 5000, NULL, true, 'active'),
    ('zoo-rap', 'Zoo Rap', '🎤', 180, 'music', 'Zoo rap animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/zoo-rap.webm', 'video', 'zoo_rap', 'uncommon', false, 3500, NULL, true, 'active'),
    ('mai-rap', 'Mai Rap', '🎵', 220, 'music', 'Mai rap animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/mai-rap.webm', 'video', 'mai_rap', 'rare', false, 4000, NULL, true, 'active'),
    ('im-him', 'IM HIM', '💪', 350, 'brag', 'IM HIM brag animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/im-him.webm', 'video', 'im_him', 'epic', false, 4500, NULL, true, 'active'),
    ('take-over', 'Take Over', '🎯', 400, 'action', 'Take over animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/take-over.webm', 'video', 'take_over', 'legendary', true, 6000, NULL, true, 'active'),
    ('universe-2-0', 'Universe 2.0', '🌌', 1000, 'cosmic', 'Universe 2.0 cosmic animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/universe-2-0.webm', 'fullscreen_video', 'universe_2_0', 'mythic', true, 7000, NULL, true, 'active'),
    ('mai-paparazzi-queen', 'MAI Paparazzi Queen', '📸', 2500, 'legendary', 'Spectacular high-value livestream gift animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/mai-paparazzi-queen.webm', 'fullscreen_video', 'mai_paparazzi_queen', 'mythic', true, 8000, NULL, true, 'active'),
    ('firefly-gold-coin', 'Firefly Gold Coin', '🪙', 500, 'currency', 'Shiny gold coin spins and flips', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/firefly-gold-coin.webm', 'video', 'firefly_gold_coin', 'epic', false, 4500, NULL, true, 'active'),
    ('four20', '420', '🌿', 130, 'fun', '420 celebration animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/420.webm', 'video', 'four20', 'uncommon', false, 3000, NULL, true, 'active'),
    ('ceo', 'CEO', '💼', 150, 'business', 'CEO business animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/ceo.webm', 'video', 'ceo', 'rare', false, 3500, NULL, true, 'active'),
    ('10-coins', '10 Coins', '🪙', 10, 'currency', 'Ten coins burst animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/10-coins.webm', 'video', '10_coins', 'common', false, 2500, NULL, true, 'active'),
    ('shots', 'Shots', '🥃', 120, 'fun', 'Shots celebration animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/shots.webm', 'video', 'shots', 'uncommon', false, 3000, NULL, true, 'active'),
    ('toilet-paper', 'Toilet Paper', '🧻', 80, 'fun', 'Toilet paper roll animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/toilet-paper.webm', 'video', 'toilet_paper', 'common', false, 2500, NULL, true, 'active'),
    ('click-me', 'Click Me', '👆', 40, 'fun', 'Click me animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/click-me.webm', 'video', 'click_me', 'common', false, 2000, NULL, true, 'active'),
    ('mai-troll-planet', 'Mai Troll Planet', '🪐', 25000, 'cosmic', 'Mai Troll Planet animation', 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/gift-videos/mai-troll-planet.mp4', 'video', 'mai_troll_planet', 'legendary', true, 15000, NULL, true, 'active')
) AS seed (
  gift_slug,
  name,
  icon,
  coin_cost,
  category,
  description,
  animation_url,
  animation_type,
  animation_key,
  rarity,
  is_fullscreen,
  animation_duration_ms,
  sound_url,
  is_active,
  status
)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.gift_items existing
  WHERE existing.gift_slug = seed.gift_slug
);

-- Sync purchasable_items with the updated gift catalog
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchasable_items') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_purchasable_items_item_key_unique
      ON public.purchasable_items (item_key)
      WHERE item_key IS NOT NULL;

    INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_active, metadata)
SELECT
  item_key,
  display_name,
  category,
  coin_price,
  is_active,
  metadata::jsonb
FROM (
  VALUES
    ('party-popper', 'Party Popper', 'gift', 100, true, '{"icon": "🎉", "subcategory": "celebration", "animation_url": "/storage/v1/object/public/gift-videos/party-popper.webm"}'),
    ('thumbs-up', 'Thumbs Up', 'gift', 50, true, '{"icon": "👍", "subcategory": "reaction", "animation_url": "/storage/v1/object/public/gift-videos/thumbs-up.webm"}'),
    ('troll-laugh', 'Troll Laugh', 'gift', 200, true, '{"icon": "😂", "subcategory": "reaction", "animation_url": "/storage/v1/object/public/gift-videos/troll-laugh.webm"}'),
    ('eyeball', 'Eyeball', 'gift', 150, true, '{"icon": "👁", "subcategory": "scary", "animation_url": "/storage/v1/object/public/gift-videos/eyeball.webm"}'),
    ('jail-bars', 'Jail Bars', 'gift', 300, true, '{"icon": "⛓", "subcategory": "punishment", "animation_url": "/storage/v1/object/public/gift-videos/jail-bars.webm"}'),
    ('pie-to-face', 'Pie to Face', 'gift', 250, true, '{"icon": "🥧", "subcategory": "fun", "animation_url": "/storage/v1/object/public/gift-videos/pie-to-face.webm"}'),
    ('screaming-ghost', 'Screaming Ghost', 'gift', 175, true, '{"icon": "👻", "subcategory": "scary", "animation_url": "/storage/v1/object/public/gift-videos/screaming-ghost.webm"}'),
    ('angry-goose', 'Angry Goose', 'gift', 200, true, '{"icon": "🪿", "subcategory": "reaction", "animation_url": "/storage/v1/object/public/gift-videos/angry-goose.webm"}'),
    ('dancing-banana', 'Dancing Banana', 'gift', 100, true, '{"icon": "🍌", "subcategory": "fun", "animation_url": "/storage/v1/object/public/gift-videos/dancing-banana.webm"}'),
    ('clown-horn', 'Clown Horn', 'gift', 125, true, '{"icon": "🎺", "subcategory": "fun", "animation_url": "/storage/v1/object/public/gift-videos/clown-horn.webm"}'),
    ('chicken', 'Chicken', 'gift', 75, true, '{"icon": "🐔", "subcategory": "animal", "animation_url": "/storage/v1/object/public/gift-videos/chicken.webm"}'),
    ('egg-toss', 'Egg Toss', 'gift', 90, true, '{"icon": "🥚", "subcategory": "fun", "animation_url": "/storage/v1/object/public/gift-videos/egg-toss.webm"}'),
    ('tomato', 'Tomato', 'gift', 60, true, '{"icon": "🍅", "subcategory": "food", "animation_url": "/storage/v1/object/public/gift-videos/tomato.webm"}'),
    ('ocean', 'Ocean', 'gift', 150, true, '{"icon": "🌊", "subcategory": "nature", "animation_url": "/storage/v1/object/public/gift-videos/ocean.webm"}'),
    ('bank-heist', 'Bank Heist', 'gift', 500, true, '{"icon": "🏦", "subcategory": "action", "animation_url": "/storage/v1/object/public/gift-videos/bank-heist.webm"}'),
    ('zoo-rap', 'Zoo Rap', 'gift', 180, true, '{"icon": "🎤", "subcategory": "music", "animation_url": "/storage/v1/object/public/gift-videos/zoo-rap.webm"}'),
    ('mai-rap', 'Mai Rap', 'gift', 220, true, '{"icon": "🎵", "subcategory": "music", "animation_url": "/storage/v1/object/public/gift-videos/mai-rap.webm"}'),
    ('im-him', 'IM HIM', 'gift', 350, true, '{"icon": "💪", "subcategory": "brag", "animation_url": "/storage/v1/object/public/gift-videos/im-him.webm"}'),
    ('take-over', 'Take Over', 'gift', 400, true, '{"icon": "🎯", "subcategory": "action", "animation_url": "/storage/v1/object/public/gift-videos/take-over.webm"}'),
    ('universe-2-0', 'Universe 2.0', 'gift', 1000, true, '{"icon": "🌌", "subcategory": "cosmic", "animation_url": "/storage/v1/object/public/gift-videos/universe-2-0.webm"}'),
    ('mai-paparazzi-queen', 'MAI Paparazzi Queen', 'gift', 2500, true, '{"icon": "📸", "subcategory": "legendary", "animation_url": "/storage/v1/object/public/gift-videos/mai-paparazzi-queen.webm"}'),
    ('firefly-gold-coin', 'Firefly Gold Coin', 'gift', 500, true, '{"icon": "🪙", "subcategory": "currency", "animation_url": "/storage/v1/object/public/gift-videos/firefly-gold-coin.webm"}'),
    ('four20', '420', 'gift', 130, true, '{"icon": "🌿", "subcategory": "fun", "animation_url": "/storage/v1/object/public/gift-videos/420.webm"}'),
    ('ceo', 'CEO', 'gift', 150, true, '{"icon": "💼", "subcategory": "business", "animation_url": "/storage/v1/object/public/gift-videos/ceo.webm"}'),
    ('10-coins', '10 Coins', 'gift', 10, true, '{"icon": "🪙", "subcategory": "currency", "animation_url": "/storage/v1/object/public/gift-videos/10-coins.webm"}'),
    ('shots', 'Shots', 'gift', 120, true, '{"icon": "🥃", "subcategory": "fun", "animation_url": "/storage/v1/object/public/gift-videos/shots.webm"}'),
    ('toilet-paper', 'Toilet Paper', 'gift', 80, true, '{"icon": "🧻", "subcategory": "fun", "animation_url": "/storage/v1/object/public/gift-videos/toilet-paper.webm"}'),
    ('click-me', 'Click Me', 'gift', 40, true, '{"icon": "👆", "subcategory": "fun", "animation_url": "/storage/v1/object/public/gift-videos/click-me.webm"}'),
    ('mai-troll-planet', 'Mai Troll Planet', 'gift', 25000, true, '{"icon": "🪐", "subcategory": "cosmic", "animation_url": "/storage/v1/object/public/gift-videos/mai-troll-planet.mp4"}')
  ) AS seed (
    item_key,
    display_name,
    category,
    coin_price,
    is_active,
    metadata
  )
WHERE NOT EXISTS (
  SELECT 1
  FROM public.purchasable_items existing
  WHERE existing.item_key = seed.item_key
);
  END IF;
END $$;
